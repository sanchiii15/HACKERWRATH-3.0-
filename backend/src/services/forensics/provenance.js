// IPTC DigitalSourceType values that declare AI involvement.
const AI_SOURCE_TYPES = /trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia/i;

/*
 * Content provenance from metadata already read by exiftool: C2PA / Content Credentials
 * manifests (JUMBF boxes) and IPTC digital source type. ExifTool shows that a manifest
 * exists but does not verify its signature, so this is reported as "present", not "valid".
 */
export function inspectProvenance(exif = {}) {
  const entries = Object.entries(exif);
  const c2paTags = entries.filter(([k, v]) => /jumd|jumbf|c2pa|claim/i.test(k) || (typeof v === 'string' && /c2pa/i.test(v)));
  const find = (re) => entries.find(([k]) => re.test(k))?.[1];

  const digitalSourceType = find(/DigitalSourceType/i);
  const claimGenerator = find(/ClaimGenerator/i) ?? c2paTags.find(([, v]) => typeof v === 'string' && /\//.test(v))?.[1];
  const aiDisclosed = typeof digitalSourceType === 'string' && AI_SOURCE_TYPES.test(digitalSourceType);

  return {
    c2paPresent: c2paTags.length > 0,
    c2paTags: c2paTags.slice(0, 10).map(([k]) => k),
    claimGenerator: typeof claimGenerator === 'string' ? claimGenerator : undefined,
    digitalSourceType: typeof digitalSourceType === 'string' ? digitalSourceType : undefined,
    aiDisclosed,
  };
}
