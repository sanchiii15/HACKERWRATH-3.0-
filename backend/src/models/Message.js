import mongoose from 'mongoose';

const { Schema } = mongoose;

// A pasted message (text + links) and its scam analysis.
const messageSchema = new Schema(
  {
    text: { type: String, required: true, maxlength: 5000 },
    sha256: { type: String, index: true },
    textScore: Number,
    signals: Schema.Types.Mixed, // [{ key, label, detail, weight, matches: [{ start, end, text }] }]
    links: Schema.Types.Mixed, // [{ url, domain, finalUrl, redirects, registered, ageDays, flags, score, mediaScan }]
    risk: {
      level: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      score: Number,
      headline: String,
      reasons: [String],
      action: String,
    },
  },
  { timestamps: true },
);

export const Message = mongoose.model('Message', messageSchema);
