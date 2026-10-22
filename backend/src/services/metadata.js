import { exiftool } from 'exiftool-vendored';

// Known AI generators / editing tools that leave traces in metadata.
// A C2PA manifest on its own is not one: cameras and editors sign files too (see forensics/provenance.js).
const GENERATOR_PATTERN =
  /stable.?diffusion|midjourney|dall.?e|openai|firefly|imagen|gemini|flux|comfyui|automatic1111|novelai|leonardo|runway|sora|pika|kling|synthesia|heygen|d-id|elevenlabs|deepfacelab|faceswap|roop|ai.?generated|generative|trainedalgorithmicmedia/i;

// Tags most likely to carry generator info.
const GENERATOR_FIELDS = [
  'Software', 'CreatorTool', 'ProcessingSoftware', 'HistorySoftwareAgent', 'Producer',
  'Encoder', 'EncodedBy', 'Comment', 'UserComment', 'ImageDescription', 'Description',
  'Parameters', 'Prompt', 'Workflow', 'DigitalSourceType', 'Credit', 'Artist', 'Make', 'Model',
  'ClaimGenerator', 'ActionsSoftwareAgentName', 'HandlerVendorID',
];

const CAMERA_FIELDS = ['Make', 'Model', 'LensModel', 'ExposureTime', 'FNumber', 'ISO', 'DateTimeOriginal'];

// Keep only JSON-safe primitive values so the doc stays small and serializable.
function sanitize(tags) {
  const out = {};
  for (const [key, value] of Object.entries(tags)) {
    if (key === 'SourceFile' || key === 'errors' || key === 'warnings') continue;
    if (value == null) continue;
    if (typeof value === 'string') out[key] = value.length > 500 ? `${value.slice(0, 500)}…` : value;
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
    else if (typeof value?.toString === 'function' && value.constructor?.name?.startsWith('ExifDate')) {
      out[key] = value.toString();
    }
  }
  return out;
}

export async function inspectMetadata(filePath) {
  const tags = await exiftool.read(filePath);
  const exif = sanitize(tags);

  const generatorTags = [];
  for (const [tag, value] of Object.entries(exif)) {
    if (typeof value !== 'string') continue;
    const isGeneratorField = GENERATOR_FIELDS.some((f) => tag.toLowerCase().includes(f.toLowerCase()));
    if (isGeneratorField && GENERATOR_PATTERN.test(value)) generatorTags.push({ tag, value });
  }

  const hasCameraExif = CAMERA_FIELDS.filter((f) => exif[f] != null).length >= 3;

  return { exif, generatorTags, hasCameraExif };
}

export function closeExiftool() {
  return exiftool.end();
}
