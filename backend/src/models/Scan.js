import mongoose from 'mongoose';

const { Schema } = mongoose;

// A time range the detector flagged (frame or audio segment).
const anomalySchema = new Schema(
  {
    source: { type: String, enum: ['video', 'frame', 'audio'], required: true },
    start: { type: Number, required: true }, // seconds
    end: { type: Number, required: true },
    score: { type: Number, min: 0, max: 1, required: true },
    label: String,
  },
  { _id: false },
);

// Score for one stress-test variant (original, compressed, resized, ...).
const variantSchema = new Schema(
  {
    name: { type: String, required: true },
    description: String,
    score: { type: Number, min: 0, max: 1 },
    error: String,
  },
  { _id: false },
);

const modalitySchema = new Schema(
  {
    engine: String, // "remote" | "onnx" | "stub"
    score: { type: Number, min: 0, max: 1 }, // mean across variants
    variants: [variantSchema],
    // How much the score moved under compression/resizing. High = fragile result.
    robustnessSpread: Number,
    // Per-category probabilities on the original file, e.g. { face_swap: 0.7, lip_sync: 0.2 }.
    types: { type: Map, of: Number },
    // Raw outputs of each underlying model on the original file, for transparency.
    models: Schema.Types.Mixed,
  },
  { _id: false },
);

const confidenceSchema = new Schema(
  {
    score: { type: Number, min: 0, max: 1 }, // fused probability of manipulation
    low: { type: Number, min: 0, max: 1 },
    high: { type: Number, min: 0, max: 1 },
    margin: Number,
    band: { type: String, enum: ['likely_authentic', 'inconclusive', 'likely_manipulated'] },
    reasons: [String],
  },
  { _id: false },
);

const riskMetricSchema = new Schema(
  {
    key: { type: String, required: true },
    label: String,
    value: { type: Number, min: 0, max: 1 }, // 0 = no risk, 1 = maximum risk
    level: { type: String, enum: ['low', 'medium', 'high'] },
    detail: String,
  },
  { _id: false },
);

const riskSchema = new Schema(
  {
    level: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    headline: String, // e.g. "Possible face-swap deepfake"
    action: String, // what the user should do next
    primaryType: String, // most likely manipulation category, if any
    metrics: [riskMetricSchema],
    types: [{ key: String, label: String, probability: Number, _id: false }],
  },
  { _id: false },
);

const scanSchema = new Schema(
  {
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    sha256: { type: String, required: true, index: true },
    mediaType: { type: String, enum: ['video', 'image', 'audio'], required: true },
    status: {
      type: String,
      enum: ['queued', 'processing', 'complete', 'failed'],
      default: 'queued',
      index: true,
    },
    stage: String, // human-readable progress step
    error: String,

    metadata: {
      container: String,
      duration: Number,
      width: Number,
      height: Number,
      videoCodec: String,
      audioCodec: String,
      fps: Number,
      bitrate: Number,
      exif: Schema.Types.Mixed,
      generatorTags: [{ tag: String, value: String, _id: false }],
      hasCameraExif: Boolean,
    },

    results: {
      video: modalitySchema,
      image: modalitySchema,
      audio: modalitySchema,
    },
    anomalies: [anomalySchema],
    confidence: confidenceSchema,
    risk: riskSchema,

    // Model-free signal checks: ELA, frequency spectrum, timing, audio, provenance, pHash.
    forensics: Schema.Types.Mixed,

    // User corrections, collected to measure and retrain the detectors later.
    feedback: [
      {
        label: { type: String, enum: ['authentic', 'manipulated', 'unsure'], required: true },
        note: { type: String, maxlength: 1000 },
        createdAt: { type: Date, default: Date.now },
        _id: false,
      },
    ],

    processingMs: Number,
  },
  { timestamps: true },
);

export const Scan = mongoose.model('Scan', scanSchema);
