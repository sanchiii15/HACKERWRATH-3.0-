import dns from 'node:dns/promises';
import net from 'node:net';

const TIMEOUT_MS = 6000;
const MAX_REDIRECTS = 5;
const USER_AGENT = 'Mozilla/5.0 (compatible; DeepfakeScreener-LinkCheck/1.0)';

// Private, loopback, link-local and other non-public ranges the server must never reach.
function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 192 && b === 0)
      || (a === 198 && (b === 18 || b === 19));
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8')
    || v6.startsWith('fe9') || v6.startsWith('fea') || v6.startsWith('feb') || v6.startsWith('ff');
}

// Throws unless the URL is a plain public http(s) address.
export async function assertPublicUrl(url) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https links are checked');
  if (url.port && url.port !== '80' && url.port !== '443') throw new Error('Links to unusual ports are not fetched');
  if (url.username || url.password) throw new Error('Links with embedded credentials are not fetched');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error('Domain does not resolve');
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error('Points to a private or local network address');
}

/*
 * Follows redirects one hop at a time, checking every hop is public before connecting.
 * Uses HEAD (falling back to a GET whose body is discarded), so pages are never downloaded.
 * Note: DNS is resolved again by fetch itself, so a hostile DNS server could still rebind;
 * acceptable here because only headers are read and nothing is executed.
 */
export async function resolveRedirects(startUrl) {
  const chain = [];
  let current = new URL(startUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);
    let res = await fetchHead(current);
    if (res.status === 405 || res.status === 403 || res.status === 501) res = await fetchHead(current, 'GET');
    chain.push({ url: current.href, status: res.status });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current);
      continue;
    }
    return {
      chain,
      finalUrl: current.href,
      status: res.status,
      contentType: (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase(),
      contentLength: Number(res.headers.get('content-length')) || undefined,
    };
  }
  return { chain, finalUrl: current.href, status: undefined, tooManyRedirects: true };
}

async function fetchHead(url, method = 'HEAD') {
  const res = await fetch(url, {
    method,
    redirect: 'manual',
    headers: { 'user-agent': USER_AGENT, accept: '*/*' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (method === 'GET') await res.body?.cancel().catch(() => {});
  return res;
}

// Streams a public URL to disk, stopping at maxBytes. Used only for direct media links.
export async function downloadToFile(url, filePath, maxBytes) {
  const fs = await import('node:fs');
  await assertPublicUrl(new URL(url));
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok || !res.body) throw new Error(`Download failed with status ${res.status}`);
  const out = fs.createWriteStream(filePath);
  let received = 0;
  try {
    for await (const chunk of res.body) {
      received += chunk.length;
      if (received > maxBytes) throw new Error('File is larger than the download limit');
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
    }
  } finally {
    await new Promise((r) => out.end(r));
  }
  return received;
}

// IANA's list of which RDAP server answers for each domain ending, cached for a day.
let bootstrap = { at: 0, services: [] };
async function rdapServerFor(tld) {
  if (Date.now() - bootstrap.at > 24 * 3600 * 1000) {
    const res = await fetch('https://data.iana.org/rdap/dns.json', { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.ok) bootstrap = { at: Date.now(), services: (await res.json()).services ?? [] };
  }
  return bootstrap.services.find(([tlds]) => tlds.includes(tld))?.[1]?.[0];
}

// Registration date from the domain's official RDAP registry server (null if unavailable).
export async function domainRegistered(domain) {
  const base = await rdapServerFor(domain.split('.').pop());
  if (!base) return null;
  const res = await fetch(`${base.replace(/\/$/, '')}/domain/${encodeURIComponent(domain)}`, {
    headers: { accept: 'application/rdap+json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const body = await res.json();
  const event = body.events?.find((e) => e.eventAction === 'registration');
  return event?.eventDate ? new Date(event.eventDate) : null;
}
