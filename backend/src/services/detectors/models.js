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
  // ViT classifier: Artificial (AI-generated) / Deepfake (face manipulation) / Real.
  imageTriage: {
    repo: 'prithivMLmods/AI-vs-Deepfake-vs-Real-ONNX',
    revision: '8a3d50ffa59655423ccaa7d2b3270cba20921cef',
    file: 'onnx/model_quantized.onnx',
    license: 'Apache-2.0',
    image: { width: 224, height: 224, resample: 'bilinear', mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5] },
    output: 'softmax',
    labels: ['artificial', 'deepfake', 'real'],
  },
  // wav2vec2-base fine-tuned for bona fide vs spoofed speech (ASVspoof 2021, 92.8% reported accuracy).
  voice: {
    repo: 'ai8shiro/deepfake-audio-wav2vec2-ONNX',
    revision: '78a7991b7f413bd6ce15efd7cb27000736acc78a',
    file: 'onnx/model.onnx',
    license: 'MIT',
    audio: { sampleRate: 16000, normalize: true },
    output: 'softmax',
    labels: ['real', 'fake'],
  },
};

export const modelPath = (key) => path.join(MODELS_DIR, key, path.basename(MODELS[key].file));
export const modelUrl = (key) => `https://huggingface.co/${MODELS[key].repo}/resolve/${MODELS[key].revision}/${MODELS[key].file}`;
export const hasModel = (key) => fs.existsSync(modelPath(key));
