---
title: Deepfake Screener
emoji: 🛡️
colorFrom: gray
colorTo: green
sdk: docker
app_port: 7860
pinned: false
short_description: Screens video, images, voice and messages for deepfakes and scams
---

# Deepfake Screener

A web app that screens suspicious **video, images, voice recordings and messages** for deepfakes and scams. Instead
of a bare “fake” label it reports a risk level, the most likely kind of manipulation, and how far the result can be
trusted after the file has been compressed and re-uploaded.

Built for HACKERWRATH 3.0.

## Features

- **Video, Image and Voice checks**: three pretrained AI models (ONNX, CPU) plus forensic checks (error levels,
  frequency spectrum, frame timing, scene cuts, audio bandwidth, digital silence, C2PA content credentials,
  look-alike fingerprints). Every file is also re-tested in compressed form.
- **Message check**: highlights scam phrases and checks every link (look-alike domains, redirects, domain age).
- **Live Call Guard**: listens to a call as it happens and warns if the voice sounds cloned.
- **Stay safe** guidance with India’s 1930 cybercrime helpline.

## Tech stack

React 19 · Vite · Tailwind CSS · shadcn/ui · Recharts · Wavesurfer.js · Node.js 24 · Express 5 · MongoDB ·
FFmpeg · ExifTool · ONNX Runtime

## Run locally

Needs Node.js 24, FFmpeg and MongoDB.

```bash
npm run setup   # install packages and download the AI models
npm run dev     # API on :5000, app on :5173
```

## Deploy

See [DEPLOY.md](DEPLOY.md) for Hugging Face Spaces + MongoDB Atlas.
