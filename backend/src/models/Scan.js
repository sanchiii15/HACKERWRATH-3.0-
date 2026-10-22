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
    engine: String, // "remote" | "stub"
    score: { type: Number, min: 0, max: 1 }, // mean across variants
    variants: [variantSchema],
    // How much the score moved under compression/resizing. High = fragile result.
    robustnessSpread: Number,
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

    processingMs: Number,
  },
  { timestamps: true },
);

export const Scan = mongoose.model('Scan', scanSchema);
