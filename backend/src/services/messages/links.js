import { resolveRedirects, domainRegistered } from './safeFetch.js';

const MAX_LINKS = 5;

// Bare domains (no http:// or www.) are only treated as links for these endings,
// so file names like "photo.jpg" or "Rs.500" are never mistaken for links.
const COMMON_TLDS = new Set(['com', 'net', 'org', 'in', 'co', 'io', 'info', 'biz', 'xyz', 'top', 'online', 'site', 'shop',
  'app', 'dev', 'me', 'ly', 'live', 'link', 'click', 'zip', 'mov', 'uk', 'us', 'ai', 'gov', 'edu', 'tk', 'ml', 'ga', 'cf',
  'gq', 'cc', 'ru', 'cn', 'icu', 'cam', 'sbs', 'cfd', 'store', 'tech', 'pro', 'vip', 'win', 'bid', 'loan', 'work', 'rest']);

// Endings that are cheap or free to register and over-represented in phishing.
const RISKY_TLDS = new Set(['zip', 'mov', 'top', 'xyz', 'click', 'link', 'work', 'rest', 'gq', 'tk', 'ml', 'cf', 'ga', 'cam',
  'icu', 'sbs', 'cfd', 'quest', 'bond', 'win', 'bid', 'loan', 'vip', 'buzz', 'monster']);

const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'ow.ly',
  'tiny.cc', 'rebrand.ly', 'bitly.com', 'shorte.st', 'v.gd', 'surl.li', 't.ly', 'urlz.fr', 'lnkd.in']);

// Two-label public suffixes common in India and elsewhere, so "sbi.co.in" → registrable "sbi.co.in".
const SECOND_LEVEL = new Set(['co.in', 'net.in', 'org.in', 'gov.in', 'nic.in', 'ac.in', 'edu.in', 'res.in', 'firm.in', 'gen.in',
  'ind.in', 'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'net.au', 'co.nz', 'com.br', 'co.jp', 'com.sg', 'com.my']);

// Brands commonly impersonated, with the domains they actually use.
const BRANDS = [
  ['SBI', 'sbi', ['sbi.co.in', 'onlinesbi.sbi', 'sbi.bank.in', 'sbicard.com']],
  ['HDFC Bank', 'hdfc', ['hdfcbank.com', 'hdfc.com', 'hdfcbank.bank.in']],
  ['ICICI Bank', 'icici', ['icicibank.com', 'icici.bank.in']],
  ['Axis Bank', 'axisbank', ['axisbank.com']],
  ['Paytm', 'paytm', ['paytm.com', 'paytm.in']],
  ['PhonePe', 'phonepe', ['phonepe.com']],
  ['Google Pay', 'gpay', ['pay.google.com', 'google.com']],
  ['Google', 'google', ['google.com', 'google.co.in', 'goo.gl', 'g.co', 'youtube.com']],
  ['Amazon', 'amazon', ['amazon.com', 'amazon.in', 'amzn.to', 'amzn.in']],
  ['Flipkart', 'flipkart', ['flipkart.com', 'fkrt.it']],
  ['PayPal', 'paypal', ['paypal.com', 'paypal.me']],
  ['Apple', 'apple', ['apple.com', 'icloud.com']],
  ['Microsoft', 'microsoft', ['microsoft.com', 'live.com', 'office.com', 'outlook.com']],
  ['WhatsApp', 'whatsapp', ['whatsapp.com', 'wa.me']],
  ['Instagram', 'instagram', ['instagram.com']],
  ['Facebook', 'facebook', ['facebook.com', 'fb.com', 'fb.me']],
  ['Netflix', 'netflix', ['netflix.com']],
  ['IRCTC', 'irctc', ['irctc.co.in']],
  ['India Post', 'indiapost', ['indiapost.gov.in']],
  ['Income Tax', 'incometax', ['incometax.gov.in']],
  ['Aadhaar / UIDAI', 'uidai', ['uidai.gov.in']],
];

const LINK_RE = /\b(?:https?:\/\/[^\s<>"'`]+|www\.[^\s<>"'`]+|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}(?:\/[^\s<>"'`]*)?)/gi;

export function extractLinks(text) {
  const links = [];
  const seen = new Set();
  for (const m of text.matchAll(LINK_RE)) {
    let raw = m[0].replace(/[.,;:!?)\]}'"]+$/, '');
    const hasScheme = /^https?:\/\//i.test(raw);
    if (!hasScheme && !/^www\./i.test(raw)) {
      const tld = raw.split('/')[0].split('.').pop().toLowerCase();
      if (!COMMON_TLDS.has(tld)) continue;
      if (/@/.test(text[m.index - 1] ?? '')) continue; // part of an email address
    }
    let url;
    try {
      url = new URL(hasScheme ? raw : `http://${raw}`);
    } catch {
      continue;
    }
    if (seen.has(url.href)) continue;
    seen.add(url.href);
    links.push({ raw, url: url.href, start: m.index, end: m.index + raw.length });
    if (links.length >= MAX_LINKS) break;
  }
  return links;
}

export function registrableDomain(host) {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  if (labels.length <= 2) return labels.join('.');
  const lastTwo = labels.slice(-2).join('.');
  return SECOND_LEVEL.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

const isOfficial = (domain, official) => official.some((o) => domain === o || domain.endsWith(`.${o}`));

// The brand whose official domain this is, if any.
export function officialBrandFor(domain) {
  return BRANDS.find(([, , official]) => isOfficial(domain, official))?.[0];
}

// Undo common look-alike swaps (0→o, 1→l, rn→m…) so "paypa1" and "arnazon" compare as the brand.
const unconfuse = (s) => s.replace(/0/g, 'o').replace(/[1!|]/g, 'l').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's').replace(/rn/g, 'm').replace(/vv/g, 'w');

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

// Static checks on one URL; no network access.
export function inspectUrl(href) {
  const url = new URL(href);
  const host = url.hostname.toLowerCase();
  const domain = registrableDomain(host);
  const flags = [];
  const add = (key, label, score, detail) => flags.push({ key, label, score, detail });

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) {
    add('ip', 'Uses a raw IP address', 0.7, 'Real services use a domain name, not a number like this.');
  }
  if (host.includes('xn--')) {
    add('punycode', 'Uses look-alike characters', 0.8, `The address is encoded (${host}); it can display as a familiar name using letters from other alphabets.`);
  }
  if (url.username || /@/.test(href.split('/').slice(0, 3).join('/'))) {
    add('userinfo', 'Hides the real address', 0.7, 'Everything before the “@” is ignored by the browser; the real site is after it.');
  }
  if (SHORTENERS.has(domain) || SHORTENERS.has(host)) {
    add('shortener', 'Shortened link', 0.15, 'The real destination is hidden; it was followed below.');
  }
  const tld = host.split('.').pop();
  if (RISKY_TLDS.has(tld)) add('tld', `Risky domain ending (.${tld})`, 0.4, `.${tld} domains are cheap to register and common in phishing.`);
  if (url.protocol === 'http:') add('http', 'Not encrypted', 0.15, 'The link uses http://, so anything typed on the page can be intercepted.');
  if (host.split('.').length >= 5 || (host.match(/-/g) ?? []).length >= 3 || host.length > 40) {
    add('complex', 'Unusually long or complex address', 0.25, 'Long, hyphen-heavy addresses are used to bury a familiar name inside a fake one.');
  }

  const sld = domain.split('.')[0];
  for (const [name, token, official] of BRANDS) {
    if (isOfficial(domain, official)) continue;
    const plain = unconfuse(sld);
    // The brand must start a label ("paypal-verify.com", "sbionline.top"), so "pineapple.com" isn't Apple.
    if (new RegExp(`(^|[.-])${token}`).test(host)) {
      add('brand', `Uses the name “${name}” but isn’t ${name}`, 0.75, `${name} uses ${official[0]}; this link goes to ${domain}.`);
      break;
    }
    if (token.length >= 5 && (plain === token || editDistance(plain, token) === 1)) {
      add('typosquat', `Looks like ${name}, spelled differently`, 0.8, `“${domain}” is close to ${name}’s ${official[0]}, a classic look-alike trick.`);
      break;
    }
  }
  if (/(login|signin|sign-in|verify|update|secure|account|kyc|wallet|unlock|reward|claim)/i.test(url.pathname + url.hostname)
    && !BRANDS.some(([, , official]) => isOfficial(domain, official))) {
    add('bait_words', 'Login or “verify” wording', 0.2, 'Pages asking you to log in or verify, on an unfamiliar domain, are a common phishing pattern.');
  }
  return { host, domain, flags };
}

const combine = (flags) => Math.min(1, 1 - flags.reduce((keep, f) => keep * (1 - f.score), 1));

// Full check of one link: static checks, then (network) redirects and domain age.
export async function analyzeLink(link) {
  const first = inspectUrl(link.url);
  const result = { ...link, host: first.host, domain: first.domain, flags: [...first.flags] };

  try {
    const r = await resolveRedirects(link.url);
    result.redirects = r.chain;
    result.finalUrl = r.finalUrl;
    result.httpStatus = r.status;
    result.contentType = r.contentType;
    result.contentLength = r.contentLength;
    const final = inspectUrl(r.finalUrl);
    result.finalDomain = final.domain;
    const owner = officialBrandFor(final.domain);
    if (owner && final.domain !== first.domain) {
      // e.g. paypa1.com → paypal.com: the brand registered the look-alike to protect its users.
      result.flags = result.flags.filter((f) => f.key !== 'typosquat' && f.key !== 'brand' && f.key !== 'bait_words');
      result.flags.push({ key: 'official_redirect', label: `Redirects to the official ${owner} site`, score: 0.05, detail: `${first.domain} forwards to ${final.domain}, which belongs to ${owner}. The look-alike was registered by the brand itself.` });
    } else if (final.domain !== first.domain) {
      if (!first.flags.some((f) => f.key === 'shortener')) {
        result.flags.push({ key: 'redirect', label: 'Redirects to a different site', score: 0.25, detail: `Opens ${final.domain}, not ${first.domain}.` });
      }
      for (const f of final.flags) if (!result.flags.some((x) => x.key === f.key)) result.flags.push({ ...f, label: `${f.label} (after redirect)` });
    }
    if (r.tooManyRedirects) result.flags.push({ key: 'redirect_loop', label: 'Too many redirects', score: 0.3, detail: 'The link bounces through more than five addresses.' });
  } catch (err) {
    const code = err.code ?? err.cause?.code;
    result.fetchError = code === 'ENOTFOUND' ? 'the domain doesn’t exist (it may have been taken down)'
      : code === 'ETIMEDOUT' || err.name === 'TimeoutError' ? 'the site didn’t respond in time'
        : code === 'ECONNREFUSED' ? 'the site refused the connection'
          : err.message.replace(/^fetch failed$/, 'the site couldn’t be reached');
    if (/private|local/i.test(result.fetchError)) {
      result.flags.push({ key: 'private', label: 'Points to a private network', score: 0.5, detail: 'The link targets a local or internal address, which a normal website never does.' });
    }
  }

  const ageDomain = result.finalDomain ?? first.domain;
  if (!/^\d/.test(ageDomain)) {
    try {
      const registered = await domainRegistered(ageDomain);
      if (registered) {
        const days = Math.floor((Date.now() - registered.getTime()) / 86400000);
        result.registered = registered.toISOString();
        result.ageDays = days;
        if (days < 30) result.flags.push({ key: 'new_domain', label: `Domain registered ${days} day${days === 1 ? '' : 's'} ago`, score: 0.75, detail: 'Brand-new domains are a strong sign of a phishing or scam site.' });
        else if (days < 180) result.flags.push({ key: 'young_domain', label: `Domain is only ${Math.round(days / 30)} months old`, score: 0.35, detail: 'Most legitimate services have used their domain for years.' });
      }
    } catch {
      // RDAP lookups are best-effort
    }
  }

  const media = /^(video|image|audio)\//.exec(result.contentType ?? '');
  if (media) result.mediaType = media[1];

  result.score = Math.round(combine(result.flags) * 1000) / 1000;
  return result;
}
