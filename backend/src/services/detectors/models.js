import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODELS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../models');

// CLIP normalization used by the Community Forensics ViT.
const CLIP_MEAN = [0.48145466, 0.4578275, 0.40821073];
const CLIP_STD = [0.26862954, 0.26130258, 0.27577711];

/*
 * Pretrained ONNX detectors, pinned to exact Hugging Face commits.
 * Download them with `npm run models:download`. Preprocessing mirrors each
 * model's preprocessor_config.json.
 */
export const MODELS = {
  // Fake-image detector trained on 2.7M images from 4,803 generators (CVPR 2025, "Community Forensics").
  aiImage: {
    repo: 'buildborderless/CommunityForensics-DeepfakeDet-ViT',
    revision: 'ac6ee457bea904a373065754107451793b56db00',
    file: 'onnx/model.onnx',
    license: 'MIT',
    image: { shortestEdge: 440, crop: 384, resample: 'bicubic', mean: CLIP_MEAN, std: CLIP_STD },
    output: 'sigmoid', // single logit: P(fake)
  },
  // ViT classifier: Artificial (AI-generated) / Deepfake / Real. Only "artificial" is used, as a
  // weak second opinion: its "deepfake" class sat near 40% on every real and fake test image.
  imageTriage: {
    repo: 'prithivMLmods/AI-vs-Deepfake-vs-Real-ONNX',
    revision: '8a3d50ffa59655423ccaa7d2b3270cba20921cef',
    file: 'onnx/model_quantized.onnx',
    license: 'Apache-2.0',
    image: { width: 224, height: 224, resample: 'bilinear', mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] },
    output: 'softmax',
    labels: ['artificial', 'deepfake', 'real'],
  },
  // wav2vec2 XLS-R (315M) fine-tuned on ASVspoof 2019 LA, i.e. text-to-speech and voice
  // conversion attacks (EER 4.0%). Replaces a model trained on ASVspoof 2021 PA (replay attacks),
  // which flagged ordinary room recordings as fake.
  voice: {
    repo: 'pranjal-pravesh/wav2vec2-large-xlsr-deepfake-audio-classification',
    revision: '4b1c4a294ab68ab444dac038fec8e8da2cc1982f',
    file: 'model_int8.onnx',
    license: 'Apache-2.0',
    audio: { sampleRate: 16000, normalize: true, attentionMask: 'int32' },
    output: 'softmax',
    labels: ['real', 'fake'],
  },
};

export const modelPath = (key) => path.join(MODELS_DIR, key, path.basename(MODELS[key].file));
export const modelUrl = (key) => `https://huggingface.co/${MODELS[key].repo}/resolve/${MODELS[key].revision}/${MODELS[key].file}`;
export const hasModel = (key) => fs.existsSync(modelPath(key));
