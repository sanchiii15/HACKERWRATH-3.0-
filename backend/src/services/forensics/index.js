import { Scan } from '../../models/Scan.js';
import { errorLevelAnalysis, frequencySpectrum, perceptualHash, hammingDistance } from './image.js';
import { frameTiming, sceneCuts } from './video.js';
import { audioSignal } from './audio.js';
import { inspectProvenance } from './provenance.js';
import { clamp01 } from './fft.js';

const DUPLICATE_MAX_DISTANCE = 10; // of 64 bits
const LOSSLESS_CODECS = /^(png|bmp|tiff|gif|qoi)$/i;

const flagFor = (score) => (score < 0.35 ? 'ok' : score < 0.65 ? 'mixed' : 'concern');
const pct = (x) => `${Math.round(x * 100)}%`;
const khz = (hz) => `${(hz / 1000).toFixed(1)} kHz`;

// Runs one check, recording failures instead of failing the whole scan.
async function attempt(errors, name, fn) {
  try {
    return await fn();
  } catch (err) {
    errors.push({ check: name, message: err.message.slice(0, 300) });
    return null;
  }
}

async function findNearDuplicates(scanId, phash) {
  const candidates = await Scan.find({ _id: { $ne: scanId }, 'forensics.phash': { $exists: true } })
    .select('originalName mediaType forensics.phash risk.level risk.headline createdAt')
    .sort({ createdAt: -1 })
    .limit(2000)
    .lean();
  return candidates
    .map((s) => ({
      scanId: s._id,
      originalName: s.originalName,
      mediaType: s.mediaType,
      distance: s.forensics?.phash ? hammingDistance(phash, s.forensics.phash) : Infinity,
      riskLevel: s.risk?.level,
      headline: s.risk?.headline,
      createdAt: s.createdAt,
    }))
    .filter((m) => m.distance <= DUPLICATE_MAX_DISTANCE)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
}

/*
 * Signal-level forensic checks that need no ML model. Each produces an evidence item
 * (0 = no concern, 1 = strong concern); the weighted mean feeds into the overall score.
 */
export async function runForensics({ scanId, filePath, mediaType, info, exif }) {
  const errors = [];
  const evidence = [];
  const anomalies = [];
  const out = { errors, evidence };
  const add = (key, label, score, detail, weight = 1, flag) =>
    evidence.push({ key, label, score: Math.round(score * 1000) / 1000, flag: flag ?? flagFor(score), detail, weight });

  const midpoint = info.duration ? info.duration / 2 : undefined;

  // ---- Image-level checks (images, and a middle frame of videos) ----
  if (mediaType === 'image' || (mediaType === 'video' && info.hasVideo)) {
    const seek = mediaType === 'video' ? midpoint : undefined;

    if (mediaType === 'image' && info.width && info.height) {
      const lossless = LOSSLESS_CODECS.test(info.videoCodec ?? '');
      const ela = await attempt(errors, 'ela', () =>
        errorLevelAnalysis(filePath, { width: info.width, height: info.height, lossless }));
      if (ela) {
        out.ela = ela;
        add('ela', 'Error level analysis', ela.score,
          lossless
            ? `Lossless source, so compression traces are weak. Block outlier ratio ${ela.outlierRatio.toFixed(1)}×.`
            : `Brightest regions re-compress ${ela.outlierRatio.toFixed(1)}× more than typical regions${ela.score >= 0.35 ? ', which can indicate pasted or edited areas' : ''}.`,
          lossless ? 0.4 : 0.8);
      }
    }

    const spectrum = await attempt(errors, 'spectrum', () => frequencySpectrum(filePath, { seek }));
    if (spectrum) {
      out.spectrum = spectrum;
      add('spectrum', 'Frequency artifacts', spectrum.score,
        spectrum.score >= 0.35
          ? `Periodic high-frequency peaks (strength ${spectrum.peakStrength.toFixed(1)}), a pattern left by some generators and upscalers.`
          : `No strong periodic peaks (strength ${spectrum.peakStrength.toFixed(1)}); high-frequency share ${pct(spectrum.highFrequencyShare)}.`,
        0.6);
    }

    const phash = await attempt(errors, 'phash', () => perceptualHash(filePath, { seek }));
    if (phash) {
      out.phash = phash;
      const matches = await attempt(errors, 'duplicates', () => findNearDuplicates(scanId, phash));
      out.matches = matches ?? [];
      if (out.matches.length) {
        const flagged = out.matches.find((m) => m.riskLevel === 'high' || m.riskLevel === 'critical');
        add('duplicates', 'Seen before', flagged ? 0.7 : 0.2,
          `Visually matches ${out.matches.length} earlier scan(s)${flagged ? `, including one rated ${flagged.riskLevel} risk ("${flagged.originalName}")` : ''}.`,
          flagged ? 1 : 0.3, flagged ? 'concern' : 'info');
      }
    }
  }

  // ---- Video timing and cuts ----
  if (mediaType === 'video' && info.hasVideo) {
    const timing = await attempt(errors, 'timing', () => frameTiming(filePath));
    if (timing) {
      out.timing = timing;
      add('timing', 'Frame timing', timing.score,
        `${pct(timing.irregularRatio)} of ${timing.frames} frame intervals are irregular${timing.measuredFps ? ` (≈${timing.measuredFps.toFixed(1)} fps)` : ''}.`,
        0.6);
      for (const g of timing.gaps.slice(0, 10)) anomalies.push({ source: 'video', start: g.start, end: g.end, score: 0.5, label: 'Frame timing gap' });
    }
    const cuts = await attempt(errors, 'cuts', () => sceneCuts(filePath));
    if (cuts) {
      out.cuts = cuts;
      const score = cuts.count ? clamp01(0.3 + 0.12 * cuts.count) : 0.05;
      add('cuts', 'Scene cuts', score,
        cuts.count
          ? `${cuts.count} hard cut(s) at ${cuts.cuts.slice(0, 5).map((t) => `${t.toFixed(1)}s`).join(', ')}. A single-take call or statement shouldn't have any.`
          : 'No hard cuts; the clip looks like a single continuous take.',
        0.6);
      for (const t of cuts.cuts.slice(0, 10)) anomalies.push({ source: 'video', start: t, end: t + 0.5, score: score, label: 'Scene cut (possible splice)' });
    }
  }

  // ---- Audio signal ----
  if (mediaType === 'audio' || (mediaType === 'video' && info.hasAudio)) {
    const audio = await attempt(errors, 'audio', () => audioSignal(filePath));
    if (audio && !audio.tooShort) {
      out.audio = audio;
      const bandwidthText = {
        upsampled: `Sharp cutoff at ${khz(audio.bandwidthHz)} in a ${khz(audio.sampleRate)} file: the audio was made at a lower sample rate and upsampled, which many voice generators (and some VoIP apps) do.`,
        codec: `Cutoff at ${khz(audio.bandwidthHz)}, the normal low-pass of a lossy codec such as AAC or MP3.`,
        rolloff: `Energy fades out above ${khz(audio.bandwidthHz)} without a hard cutoff; normal for speech and many microphones.`,
        full: `Full bandwidth up to ${khz(audio.bandwidthHz)}, consistent with a direct recording.`,
      }[audio.bandwidthClass];
      add('bandwidth', 'Audio bandwidth', audio.bandScore, bandwidthText, 0.8);
      add('silence', 'Digital silence', audio.silenceScore,
        audio.digitalSilence > 0.02
          ? `${pct(audio.digitalSilence)} of the audio is exact digital silence; real microphones always pick up some background noise.`
          : `Natural noise floor (${audio.noiseFloorDb} dBFS) between sounds.`,
        0.8);
    }
  }

  // ---- Provenance ----
  const provenance = inspectProvenance(exif);
  out.provenance = provenance;
  if (provenance.aiDisclosed) {
    add('provenance', 'Content credentials', 0.95, `The file declares itself AI-generated (${provenance.digitalSourceType}).`, 2);
  } else if (provenance.c2paPresent) {
    add('provenance', 'Content credentials', 0.1,
      `C2PA manifest present${provenance.claimGenerator ? ` from ${provenance.claimGenerator}` : ''}. Verify its signature with a C2PA validator before trusting it.`,
      0.5, 'info');
  } else {
    add('provenance', 'Content credentials', 0.3, 'No C2PA content credentials. Most real media has none, so this is neutral.', 0.2, 'info');
  }

  const weight = evidence.reduce((s, e) => s + e.weight, 0);
  out.score = weight ? Math.round((evidence.reduce((s, e) => s + e.score * e.weight, 0) / weight) * 1000) / 1000 : undefined;
  out.anomalies = anomalies;
  return out;
}
