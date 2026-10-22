// Modality weights: video is the primary, robustness-tested signal; image (frames) and
// voice back it up. Weights are renormalized over whichever modalities are present.
const WEIGHTS = { video: 0.5, image: 0.25, audio: 0.25 };

const BASE_MARGIN = 0.05;
const STUB_MARGIN = 0.25; // stub scores are meaningless, so the band should be wide
const AUTHENTIC_BELOW = 0.35;
const MANIPULATED_ABOVE = 0.65;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// Summarize one modality from its per-variant scores.
export function summarizeModality(engine, variants) {
  const scores = variants.map((v) => v.score).filter((s) => typeof s === 'number');
  if (!scores.length) return { engine, variants, score: undefined, robustnessSpread: undefined };
  return {
    engine,
    variants,
    score: mean(scores),
    robustnessSpread: Math.max(...scores) - Math.min(...scores),
  };
}

/*
 * Fuse modality results into a confidence band rather than a bare verdict.
 * The band widens when the detector is unstable under compression/resizing,
 * when modalities disagree, and when no real model is behind the score.
 */
export function computeConfidence(results, metadata = {}) {
  const present = Object.entries(results).filter(([, r]) => typeof r?.score === 'number');
  const reasons = [];

  if (!present.length) {
    return { score: 0.5, low: 0, high: 1, margin: 0.5, band: 'inconclusive', reasons: ['No detector produced a score'] };
  }

  const totalWeight = present.reduce((sum, [m]) => sum + WEIGHTS[m], 0);
  let score = present.reduce((sum, [m, r]) => sum + r.score * WEIGHTS[m], 0) / totalWeight;

  let margin = BASE_MARGIN;

  const maxSpread = Math.max(...present.map(([, r]) => r.robustnessSpread ?? 0));
  if (maxSpread > 0.1) reasons.push(`Score shifted by up to ${(maxSpread * 100).toFixed(0)} points under re-encoding`);
  margin += maxSpread / 2;

  if (present.length > 1) {
    const scores = present.map(([, r]) => r.score);
    const disagreement = Math.max(...scores) - Math.min(...scores);
    if (disagreement > 0.3) reasons.push('Video, image and voice detectors disagree');
    margin += disagreement / 4;
  }

  if (present.some(([, r]) => r.engine === 'stub')) {
    margin += STUB_MARGIN;
    reasons.push('No ML model connected: scores come from the development stub');
  }

  // Metadata is supporting evidence only: generator tags nudge up, camera EXIF nudges down slightly.
  if (metadata.generatorTags?.length) {
    score = Math.min(1, score + 0.15);
    reasons.push(`AI generator traces in metadata (${metadata.generatorTags.map((t) => t.tag).join(', ')})`);
  } else if (metadata.hasCameraExif) {
    score = Math.max(0, score - 0.05);
    reasons.push('Camera EXIF present (can be forged, weak evidence)');
  }

  margin = Math.min(0.5, margin);
  const low = Math.max(0, score - margin);
  const high = Math.min(1, score + margin);

  let band = 'inconclusive';
  if (low >= MANIPULATED_ABOVE) band = 'likely_manipulated';
  else if (high <= AUTHENTIC_BELOW) band = 'likely_authentic';

  const round = (x) => Math.round(x * 1000) / 1000;
  return { score: round(score), low: round(low), high: round(high), margin: round(margin), band, reasons };
}
