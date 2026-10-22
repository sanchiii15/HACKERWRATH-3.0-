import fs from 'node:fs/promises';

// IPTC DigitalSourceType values that declare AI involvement.
const AI_SOURCE_TYPES = /compositeWithTrainedAlgorithmicMedia|trainedAlgorithmicMedia|algorithmicMedia/i;

// Tools that commonly sign C2PA manifests, matched against the raw manifest bytes.
const KNOWN_SIGNERS = [
  ['OpenAI', /openai|chatgpt|dall.?e|sora/i],
  ['Adobe Firefly', /firefly/i],
  ['Adobe', /adobe|photoshop|lightroom/i],
  ['Google', /google|gemini|imagen|pixel/i],
  ['Microsoft', /microsoft|bing image creator|designer/i],
  ['Meta', /\bmeta\b|facebook|instagram/i],
  ['Midjourney', /midjourney/i],
  ['Stability AI', /stability|stable.?diffusion/i],
  ['Runway', /runwayml|runway/i],
  ['TikTok', /tiktok|bytedance/i],
  ['Truepic', /truepic/i],
  ['Leica', /leica/i],
  ['Sony', /\bsony\b/i],
  ['Nikon', /nikon/i],
  ['Canon', /\bcanon\b/i],
  ['Samsung', /samsung/i],
];

// C2PA manifests sit near the start of images (PNG caBX chunk, JPEG APP11) and at either
// end of MP4s, so reading the head and tail of the file is enough.
const SCAN_BYTES = 4 * 1024 * 1024;

async function readHeadAndTail(filePath) {
  const handle = await fs.open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    if (size <= SCAN_BYTES * 2) return await handle.readFile();
    const head = Buffer.alloc(SCAN_BYTES);
    const tail = Buffer.alloc(SCAN_BYTES);
    await handle.read(head, 0, SCAN_BYTES, 0);
    await handle.read(tail, 0, SCAN_BYTES, size - SCAN_BYTES);
    return Buffer.concat([head, tail]);
  } finally {
    await handle.close();
  }
}

// Reads the CBOR text string that starts at `pos` (major type 3, lengths up to 65535).
function cborText(buf, pos) {
  const head = buf[pos];
  let len;
  let start;
  if (head >= 0x60 && head <= 0x77) [len, start] = [head - 0x60, pos + 1];
  else if (head === 0x78) [len, start] = [buf[pos + 1], pos + 2];
  else if (head === 0x79) [len, start] = [buf.readUInt16BE(pos + 1), pos + 3];
  else return undefined;
  if (start + len > buf.length) return undefined;
  return buf.toString('utf8', start, start + len);
}

// Value of the CBOR text field `key` (claim_generator), or of `name` inside `key_info` (C2PA v2).
function cborField(buf, key) {
  const at = buf.indexOf(key);
  if (at === -1) return undefined;
  const direct = cborText(buf, at + key.length);
  if (direct && !direct.startsWith('_info')) return direct;
  const info = buf.indexOf(`${key}_info`, at);
  if (info === -1) return undefined;
  const name = buf.indexOf('dname', info); // CBOR text "name" = 0x64 'name'
  return name !== -1 && name - info < 64 ? cborText(buf, name + 5) : undefined;
}

/*
 * ExifTool decodes only the outer JUMBF boxes of a C2PA manifest; the claim and its actions
 * (who made the file and how) are CBOR inside. CBOR stores text as plain UTF-8, so the
 * standard markers can be found in the manifest bytes and the generator field decoded directly.
 */
async function scanManifest(filePath) {
  const bytes = await readHeadAndTail(filePath);
  const start = bytes.indexOf('c2pa');
  if (start === -1) return null;
  // Search only the manifest region, so unrelated pixel data can't match.
  const region = bytes.subarray(Math.max(0, start - 64), Math.min(bytes.length, start + 512 * 1024));
  const text = region.toString('latin1').replace(/[^\x20-\x7e]+/g, '\n');

  const sourceType = text.match(AI_SOURCE_TYPES)?.[0];
  const generatorField = cborField(region, 'claim_generator')?.trim();
  const signer = KNOWN_SIGNERS.find(([, re]) => re.test(generatorField ?? text))?.[0];
  const actions = [...new Set(text.match(/c2pa\.(created|edited|opened|placed|converted|cropped|filtered|color_adjustments|resized|drawing|published|transcoded)/g) ?? [])];
  return { sourceType, generator: generatorField || signer, actions };
}

/*
 * Content provenance: C2PA / Content Credentials manifests and IPTC digital source type.
 * Nothing here verifies the manifest's signature, so it is reported as "present", not "valid".
 */
export async function inspectProvenance(filePath, exif = {}) {
  const entries = Object.entries(exif);
  const c2paTags = entries.filter(([k, v]) => /jumd|jumbf|c2pa/i.test(k) || (typeof v === 'string' && /^c2pa$/i.test(v)));
  const find = (re) => entries.find(([k]) => re.test(k))?.[1];

  let manifest = null;
  if (c2paTags.length) {
    try {
      manifest = await scanManifest(filePath);
    } catch {
      manifest = null;
    }
  }

  const exifSourceType = find(/DigitalSourceType/i);
  const digitalSourceType = typeof exifSourceType === 'string' ? exifSourceType : manifest?.sourceType;
  const claimGenerator = find(/ClaimGenerator/i) ?? manifest?.generator;

  return {
    c2paPresent: c2paTags.length > 0,
    claimGenerator: typeof claimGenerator === 'string' ? claimGenerator : undefined,
    digitalSourceType,
    actions: manifest?.actions ?? [],
    aiDisclosed: typeof digitalSourceType === 'string' && AI_SOURCE_TYPES.test(digitalSourceType),
  };
}
