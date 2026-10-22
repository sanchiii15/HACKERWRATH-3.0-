/*
 * Explainable scam-signal rules for message text. Each category lists the phrases that
 * triggered it, so the UI can highlight exactly why a message was flagged.
 * Patterns cover common English and Hinglish wording seen in Indian scam messages.
 */
export const CATEGORIES = [
  {
    key: 'credentials',
    label: 'Asks for a code or password',
    detail: 'Banks, companies and officials never ask for an OTP, PIN, CVV or password.',
    weight: 0.6,
    patterns: [
      /\b(?:otp|one[- ]time (?:password|pin|code)|cvv|upi pin|atm pin|m-?pin|passcode|password|verification code|security code|login (?:details|credentials)|net ?banking (?:id|password|details))\b/gi,
      /\b(?:share|send|tell|forward|give)\b[^.!?\n]{0,30}\bcode\b/gi,
    ],
  },
  {
    key: 'remote_access',
    label: 'Asks you to install an app or share your screen',
    detail: 'Remote-access apps let a scammer control your phone or computer and empty accounts.',
    weight: 0.65,
    patterns: [
      /\b(?:anydesk|any desk|teamviewer|team viewer|rustdesk|quick ?support|airdroid|ultraviewer)\b/gi,
      /\b(?:screen ?shar(?:e|ing)|share (?:your|the) screen)\b/gi,
      /\b(?:install|download)\b[^.!?\n]{0,25}\b(?:app|apk|application)\b/gi,
      /\b\w+\.apk\b/gi,
    ],
  },
  {
    key: 'money',
    label: 'Asks for money or payment',
    detail: 'Pressure to pay, especially by gift card, crypto or to a new account, is the core of most scams.',
    weight: 0.3,
    patterns: [
      /\b(?:gift ?cards?|google play (?:card|code)|amazon (?:pay )?(?:card|voucher)|itunes card|steam card)\b/gi,
      /\b(?:bitcoin|btc|crypto(?:currency)?|usdt|ethereum)\b/gi,
      /\b(?:wire transfer|send (?:me )?(?:the )?money|transfer (?:the )?(?:money|amount|funds|payment)|make (?:the |a )?payment|pay (?:now|the (?:fee|amount)))\b/gi,
      /\b(?:processing|registration|advance|clearance|customs|release) (?:fee|charges?)\b|\brefundable deposit\b/gi,
      /(?:₹|\brs\.?|\binr)\s?\d[\d,]*(?:\.\d+)?|\$\s?\d[\d,]*/gi,
      /\b(?:new|different|another) (?:bank )?account\b|\bupi id\b/gi,
    ],
  },
  {
    key: 'urgency',
    label: 'Creates urgency',
    detail: 'Rushing you is how scammers stop you from checking with anyone else.',
    weight: 0.2,
    patterns: [
      /\b(?:urgent(?:ly)?|immediately|right (?:now|away)|asap|act now|today itself|last chance|final (?:notice|warning|reminder)|before (?:it'?s too late|midnight|end of day))\b/gi,
      /\bwithin (?:the next )?\d+ (?:min(?:ute)?s?|hours?|hrs?)\b/gi,
      /\b(?:expires?|expiring) (?:today|soon|in)\b/gi,
      /\b(?:jaldi|turant|abhi ke abhi)\b/gi,
    ],
  },
  {
    key: 'secrecy',
    label: 'Asks you to keep it secret',
    detail: 'A real manager, relative or official doesn’t need you to hide a request from others.',
    weight: 0.3,
    patterns: [
      /\b(?:don'?t|do not) (?:tell|inform|share (?:this|it) with) (?:anyone|anybody|your|others)\b/gi,
      /\bkeep (?:this|it) (?:between us|confidential|secret|private|quiet)\b/gi,
      /\b(?:strictly )?confidential\b/gi,
      /\bkisi ko (?:mat|na) (?:batana|bolna)\b/gi,
    ],
  },
  {
    key: 'impersonation',
    label: 'Claims to be someone you trust',
    detail: 'Scammers pose as bosses, relatives, banks, couriers or police. Verify on a number you already have.',
    weight: 0.25,
    patterns: [
      /\b(?:this is|it'?s) your (?:ceo|boss|manager|director|son|daughter|mom|mum|dad|mother|father|brother|sister|uncle|aunty)\b/gi,
      /\b(?:new|changed my|my new) number\b|\blost my phone\b|\bmy phone (?:is|got) (?:broken|damaged)\b/gi,
      /\b(?:calling|writing|speaking) from\b|\bon behalf of\b|\bcustomer care\b/gi,
      /\b(?:sbi|hdfc|icici|axis bank|kotak|rbi|reserve bank|income tax|customs|cbi|cyber ?cell|trai|fedex|dhl|blue ?dart|electricity board|npci)\b/gi,
    ],
  },
  {
    key: 'threat',
    label: 'Threatens a penalty or arrest',
    detail: 'Fear of blocked accounts, fines or “digital arrest” is used to make you act without thinking.',
    weight: 0.3,
    patterns: [
      /\baccount (?:will be|has been|is) (?:blocked|suspended|closed|frozen|deactivated|on hold)\b/gi,
      /\b(?:kyc|pan|aadhaar|aadhar) (?:expired|update|verification|pending|is not updated)\b/gi,
      /\b(?:digital arrest|arrest warrant|legal action|police case|court notice|money laundering)\b/gi,
      /\b(?:electricity|power|sim|number) (?:will be |is being )?(?:cut|disconnected|blocked|deactivated)\b/gi,
      /\bpenalty\b|\bfine of\b/gi,
    ],
  },
  {
    key: 'prize',
    label: 'Offers a prize, job or easy money',
    detail: 'Unexpected winnings, jobs or guaranteed returns are bait to collect fees or details.',
    weight: 0.25,
    patterns: [
      /\byou(?:'ve| have)? won\b|\b(?:winner|lottery|lucky draw|jackpot)\b/gi,
      /\b(?:claim (?:your|now|the)|free (?:gift|iphone|recharge|laptop)|cash ?back of|reward points? (?:expir|redeem))\b/gi,
      /\b(?:work from home|part[- ]time job|daily income|guaranteed returns?|double your money|investment (?:plan|scheme|opportunity))\b/gi,
      /\bearn (?:₹|rs\.?|inr|\$)\s?\d[\d,]*/gi,
    ],
  },
  {
    key: 'channel_switch',
    label: 'Moves you to another app',
    detail: 'Moving the chat to WhatsApp or Telegram takes you away from platform safety checks.',
    weight: 0.2,
    patterns: [
      /\b(?:message|text|contact|reach) me on (?:whatsapp|telegram|signal)\b/gi,
      /\b(?:join|add me on) (?:my |our )?(?:telegram|whatsapp)(?: group| channel)?\b/gi,
      /\b(?:reply|continue|talk) on (?:whatsapp|telegram)\b/gi,
    ],
  },
];

// Pairs of signals that together are much stronger than either alone.
const COMBOS = [
  { keys: ['money', 'urgency'], boost: 0.15 },
  { keys: ['money', 'secrecy'], boost: 0.15 },
  { keys: ['credentials', 'impersonation'], boost: 0.1 },
  { keys: ['threat', 'money'], boost: 0.1 },
];

// `exclude` holds [start, end) spans (the links) whose words shouldn't count as text signals.
export function analyzeText(text, { exclude = [] } = {}) {
  const insideExcluded = (m) => exclude.some((e) => m.start < e.end && m.end > e.start);
  const signals = [];
  for (const cat of CATEGORIES) {
    const matches = [];
    for (const re of cat.patterns) {
      for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
        const match = { start: m.index, end: m.index + m[0].length, text: m[0] };
        if (!insideExcluded(match)) matches.push(match);
      }
    }
    if (matches.length) {
      matches.sort((a, b) => a.start - b.start);
      signals.push({ key: cat.key, label: cat.label, detail: cat.detail, weight: cat.weight, matches: dedupe(matches) });
    }
  }

  let score = 1 - signals.reduce((keep, s) => keep * (1 - s.weight), 1);
  const keys = new Set(signals.map((s) => s.key));
  for (const c of COMBOS) if (c.keys.every((k) => keys.has(k))) score += c.boost;
  score = Math.min(1, score);

  signals.sort((a, b) => b.weight - a.weight);
  return { score: Math.round(score * 1000) / 1000, signals };
}

// Drop matches nested inside an earlier, longer match of the same category.
function dedupe(matches) {
  const out = [];
  for (const m of matches) {
    const last = out[out.length - 1];
    if (last && m.start < last.end) {
      if (m.end > last.end) last.end = m.end;
      continue;
    }
    out.push({ ...m });
  }
  return out;
}
