// Modality weights: video is the primary, robustness-tested signal; image (frames) and
// voice back it up. Weights are renormalized over whichever modalities are present.
const WEIGHTS = { video: 0.5, image: 0.25, audio: 0.25 };

const BASE_MARGIN = 0.05;
const STUB_MARGIN = 0.25; // stub scores are meaningless, so the band should be wide
const FORENSIC_WEIGHT = 0.15;
// Pretrained models are used as published, without calibration on this app's data.
const UNCALIBRATED_MARGIN = 0.08;
const FORENSIC_ONLY_MARGIN = 0.2;
const AUTHENTIC_BELOW = 0.35;
const MANIPULATED_ABOVE = 0.65;

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const topQuarterMean = (xs) => mean([...xs].sort((a, b) => b - a).slice(0, Math.max(1, Math.ceil(xs.length / 4))));

/*
 * Summarize one modality.
 * - Stress-test variants: the score is the file as uploaded ("original"); the degraded copies
 *   only measure how fragile that score is (robustnessSpread), which widens the range.
 * - Sampled frames (aggregate: 'frames'): the mean of the most suspicious quarter, and no
 *   spread, since frames differ because the scene changes, not because of compression.
 */
export function summarizeModality(engine, variants, { aggregate = 'variants' } = {}) {
  const scores = variants.map((v) => v.score).filter((s) => typeof s === 'number');
  if (!scores.length) return { engine, variants, score: undefined, robustnessSpread: undefined };
  if (aggregate === 'frames') return { engine, variants, score: topQuarterMean(scores), robustnessSpread: undefined };
  const original = variants.find((v) => v.name === 'original' && typeof v.score === 'number');
  return {
    engine,
    variants,
    score: original ? original.score : mean(scores),
    robustnessSpread: Math.max(...scores) - Math.min(...scores),
  };
}

/*
 * Fuse modality results into a confidence band rather than a bare verdict.
 * The band widens when the detector is unstable under compression/resizing,
 * when modalities disagree, and when no real model is behind the score.
 */
export function computeConfidence(results, metadata = {}, forensics) {
  const present = Object.entries(results).filter(([, r]) => typeof r?.score === 'number');
  const forensicScore = typeof forensics?.score === 'number' ? forensics.score : null;
  const reasons = [];

  if (!present.length && forensicScore === null) {
    return { score: 0.5, low: 0, high: 1, margin: 0.5, band: 'inconclusive', reasons: ['No detector produced a score'] };
  }

  let score = 0.5;
  let margin = BASE_MARGIN;
  if (present.length) {
    const totalWeight = present.reduce((sum, [m]) => sum + WEIGHTS[m], 0);
    score = present.reduce((sum, [m, r]) => sum + r.score * WEIGHTS[m], 0) / totalWeight;
  }

  // Forensic checks are heuristic, so they only nudge a model score; alone they get a wide band.
  if (forensicScore !== null) {
    score = present.length ? score * (1 - FORENSIC_WEIGHT) + forensicScore * FORENSIC_WEIGHT : forensicScore;
    if (!present.length) margin += FORENSIC_ONLY_MARGIN;
    const concerns = forensics.evidence.filter((e) => e.flag === 'concern').map((e) => e.label);
    if (concerns.length) reasons.push(`Forensic checks raised concerns: ${concerns.join(', ')}`);
  }

  const maxSpread = Math.max(0, ...present.map(([, r]) => r.robustnessSpread ?? 0));
  if (maxSpread > 0.1) reasons.push(`Score shifted by up to ${(maxSpread * 100).toFixed(0)} points under re-encoding`);
  margin += maxSpread / 2;

  if (present.length > 1) {
    const scores = present.map(([, r]) => r.score);
    const disagreement = Math.max(...scores) - Math.min(...scores);
    if (disagreement > 0.3) reasons.push('Video, image and voice detectors disagree');
    margin += disagreement / 4;
  }

  if (present.some(([, r]) => r.engine === 'onnx')) margin += UNCALIBRATED_MARGIN;

  if (present.some(([, r]) => r.engine === 'stub')) {
    margin += STUB_MARGIN;
    reasons.push('No ML model connected: scores come from the development stub');
  }

  // Metadata is supporting evidence only: generator tags nudge up, camera EXIF nudges down slightly.
  if (forensics?.provenance?.aiDisclosed) {
    score = Math.max(score, 0.85);
    reasons.push('Content credentials (C2PA) declare the file AI-generated');
  } else if (metadata.generatorTags?.length) {
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

  return { score: round(score), low: round(low), high: round(high), margin: round(margin), band, reasons };
}

const round = (x) => Math.round(x * 1000) / 1000;

export const TYPE_LABELS = {
  face_swap: 'Face swap',
  lip_sync: 'Lip-sync / face reenactment',
  ai_generated: 'Fully AI-generated',
  edited: 'Edited or spliced',
  synthetic_voice: 'Synthetic or cloned voice',
  voice_clone: 'Voice clone',
  tts: 'Synthetic speech (TTS)',
};

const TYPE_NOUNS = {
  face_swap: () => 'face-swap deepfake',
  lip_sync: () => 'lip-sync deepfake',
  ai_generated: (mediaType) => `AI-generated ${mediaType}`,
  edited: (mediaType) => `edited ${mediaType}`,
  synthetic_voice: () => 'synthetic or cloned voice',
  voice_clone: () => 'cloned voice',
  tts: () => 'synthetic (text-to-speech) voice',
};

const ACTIONS = {
  low: 'No strong warning signs. Automated screening can still miss new techniques, so stay cautious with unexpected requests.',
  medium: "Don't act on this media alone. Verify through a channel you already trust, such as calling the person back on a known number.",
  high: 'Treat as likely manipulated. Do not send money, credentials or personal data based on it, and verify with the source through a known channel.',
  critical: 'Strong signs of manipulation. Do not act on it; verify with the source through a known channel and report it to your security team or the platform.',
};

const LEVEL_ORDER = ['low', 'medium', 'high', 'critical'];
const metricLevel = (v) => (v < 0.35 ? 'low' : v < 0.65 ? 'medium' : 'high');
const pct = (x) => `${Math.round(x * 100)}%`;

// Merge per-modality category probabilities, keeping the highest for each category.
function mergeTypes(results) {
  const merged = {};
  for (const r of Object.values(results)) {
    const types = r?.types instanceof Map ? Object.fromEntries(r.types) : r?.types;
    for (const [key, p] of Object.entries(types ?? {})) merged[key] = Math.max(merged[key] ?? 0, p);
  }
  return Object.entries(merged)
    .map(([key, probability]) => ({ key, label: TYPE_LABELS[key] ?? key, probability: round(probability) }))
    .sort((a, b) => b.probability - a.probability);
}

// Seconds of the clip covered by flagged segments (overlaps counted once).
function flaggedSeconds(anomalies) {
  const ranges = anomalies.map((a) => [a.start, Math.max(a.end, a.start)]).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cursor = -Infinity;
  for (const [s, e] of ranges) {
    const from = Math.max(s, cursor);
    if (e > from) total += e - from;
    cursor = Math.max(cursor, e);
  }
  return total;
}

/*
 * Break the result into separate risk metrics (each 0 = no risk, 1 = maximum risk),
 * name the most likely kind of manipulation, and recommend an action.
 */
export function computeRisk({ mediaType, results, anomalies = [], metadata = {}, confidence, forensics }) {
  const metrics = [];
  const add = (key, label, value, detail) => metrics.push({ key, label, value: round(value), level: metricLevel(value), detail });

  add('manipulation', 'Manipulation likelihood', confidence.score,
    `${pct(confidence.score)} estimated, range ${pct(confidence.low)}–${pct(confidence.high)}`);

  add('uncertainty', 'Result uncertainty', Math.min(1, confidence.margin / 0.5),
    `±${pct(confidence.margin)} error margin`);

  const modalities = Object.values(results).filter((r) => typeof r?.score === 'number');
  const spread = Math.max(0, ...modalities.map((r) => r.robustnessSpread ?? 0));
  add('fragility', 'Compression fragility', Math.min(1, spread * 2),
    `Score moved up to ${pct(spread)} after re-encoding and resizing`);

  if (modalities.length > 1) {
    const scores = modalities.map((r) => r.score);
    const gap = Math.max(...scores) - Math.min(...scores);
    add('disagreement', 'Detector disagreement', Math.min(1, gap * 2),
      `${pct(gap)} gap between video, frame and voice detectors`);
  }

  if (metadata.generatorTags?.length) {
    add('provenance', 'Metadata / provenance', 0.95,
      `AI tool traces: ${metadata.generatorTags.map((t) => t.value).join(', ')}`);
  } else if (mediaType === 'image') {
    add('provenance', 'Metadata / provenance', metadata.hasCameraExif ? 0.15 : 0.5,
      metadata.hasCameraExif ? 'Camera EXIF present (can be forged)' : 'No camera EXIF; common for screenshots, re-uploads and generated images');
  } else {
    add('provenance', 'Metadata / provenance', 0.3, 'No generator tags or content credentials found');
  }

  if (metadata.duration && mediaType !== 'image') {
    const share = Math.min(1, flaggedSeconds(anomalies) / metadata.duration);
    add('timeline', 'Flagged timeline', share,
      anomalies.length ? `${anomalies.length} flagged segment(s), ${pct(share)} of the duration` : 'No segments flagged');
  }

  if (typeof forensics?.score === 'number') {
    const concerns = forensics.evidence.filter((e) => e.flag === 'concern').length;
    const checked = forensics.evidence.filter((e) => e.flag !== 'info').length;
    add('forensics', 'Forensic signals', forensics.score,
      `${concerns} of ${checked} signal checks raised a concern (ELA, spectrum, timing, audio)`);
  }

  let level = { likely_manipulated: 'high', inconclusive: 'medium', likely_authentic: 'low' }[confidence.band];
  if (level === 'high' && confidence.score >= 0.85 && confidence.margin <= 0.15) level = 'critical';
  const aiDeclared = Boolean(forensics?.provenance?.aiDisclosed);
  if ((metadata.generatorTags?.length || aiDeclared) && LEVEL_ORDER.indexOf(level) < LEVEL_ORDER.indexOf('high')) level = 'high';

  // Stub scores are placeholders, so never name a manipulation type from them.
  const stub = modalities.some((r) => r.engine === 'stub');
  const types = mergeTypes(results);
  // Only name a technique when a detector is fairly sure; borderline values aren't evidence of a type.
  const top = !stub && types[0]?.probability >= 0.55 ? types[0] : null;

  if (aiDeclared) {
    const by = forensics.provenance.claimGenerator ? ` by ${forensics.provenance.claimGenerator}` : '';
    return {
      level,
      headline: `Declared AI-generated ${mediaType}${by}`,
      action: 'The file’s own content credentials say it was made with AI. Treat it as synthetic unless the source can show otherwise.',
      primaryType: 'ai_generated',
      metrics,
      types,
    };
  }

  if (stub) {
    return {
      level,
      headline: 'No detection model connected',
      action: 'Detector scores come from the development stub, not a trained model. The forensic checks are real but only supporting evidence, so don’t rely on this result alone.',
      primaryType: undefined,
      metrics,
      types,
    };
  }

  let headline;
  if (level === 'low') headline = 'No strong signs of manipulation';
  else {
    const verb = level === 'medium' ? 'Possible' : 'Likely';
    headline = top ? `${verb} ${TYPE_NOUNS[top.key]?.(mediaType) ?? top.label}` : level === 'medium'
      ? 'Inconclusive: needs manual verification'
      : `${verb} manipulated ${mediaType}`;
  }

  return { level, headline, action: ACTIONS[level], primaryType: top?.key, metrics, types };
}
