# 🛡️ Deepfake Screener

**Check a suspicious video, photo, voice note or message, or let it listen to a live call, and get an honest
answer: how risky it is, why, and how far that answer can be trusted.**

Built for **HACKERWRATH 3.0**.

---

## Why

AI can clone a voice from a few seconds of audio and fake a convincing video. In India this already powers real
scams: a "relative in trouble" calling in a cloned voice, fake celebrity investment videos, "digital arrest" calls,
and SMS links that look like your bank.

Most detectors print a bare **"FAKE 97%"** that ordinary people can't interpret, and they often break on
WhatsApp-compressed files. Deepfake Screener instead:

- reports a **risk band** (*Likely authentic*, *Inconclusive*, *Likely manipulated*) with a **confidence range**,
  not a falsely precise number
- explains **why**, in plain language
- **stress-tests** every file in compressed form to see whether the verdict holds
- covers the routes scams actually use: **messages, links and live phone calls**, not just files

## Features

### 🎞️ Video, 🖼️ Image and 🎙️ Voice checks
Each upload goes through one pipeline:

1. **Fingerprint:** SHA-256 for instant cached results, plus a perceptual (DCT) hash that recognises re-saved or
   resized copies of files seen before.
2. **Metadata:** ExifTool reads editing software, camera data and **C2PA content credentials** / IPTC "digital
   source type".
3. **Decode:** FFmpeg samples video frames and extracts audio.
4. **AI models:** three pretrained detectors, run locally (see [Models](#models)).
5. **Forensics:** error level analysis, frequency spectrum, frame timing, scene cuts, audio bandwidth and digital
   silence.
6. **Stress test:** re-scores a compressed copy, the way messaging apps would send it.
7. **Verdict:** a risk band with a range, the likely type of manipulation (named only when the score is high enough),
   a timeline of suspicious segments, and the reasons. A JSON report can be downloaded.

### 💬 Message check
Paste an SMS, WhatsApp or email message:

- Highlights scam language: urgency, OTP/KYC requests, prizes, threats, "digital arrest" phrases.
- Checks every link for look-alike domains (`paypa1.com`), punycode, raw IPs, shorteners and risky TLDs.
- Follows redirects safely (SSRF-guarded) to show where a link really leads.
- Looks up **domain age** through RDAP: a "bank" domain registered last week is a red flag.
- If a link points to a video or image, downloads it and runs the deepfake scan too.

### 📞 Live Call Guard
Put a call on speaker, or share a browser tab's audio. Every 2 seconds the app analyses the last 4 seconds of speech
and shows a **live voice-clone meter** with sticky alerts.

It is honest about its limits. A phone speaker hides some of the clues (in our tests it cut an ElevenLabs clone's
score from 57% to 15%), so in microphone mode it never shows a fully green "safe".

### And also
- **History** of scans and message checks; each result can be marked right or wrong
- **How it works:** the method explained in plain language
- **Stay safe:** practical advice, India's **1930** cybercrime helpline and cybercrime.gov.in
- Dark and light themes, mobile-friendly

### Privacy
- All models run **on our own server**; no file is sent to an outside AI API.
- Uploads are **deleted after scanning**; only the hash and the result are stored.
- Per-IP rate limits, strict security headers (Helmet CSP) and SSRF protection on link checks.

## Models

All three are open-source and run with **ONNX Runtime on a normal CPU**: no GPU, no paid API. They are downloaded at
pinned versions by `npm run models:download` (about 530 MB, not committed).

| Model | Detects | Licence | Role |
|---|---|---|---|
| [buildborderless/CommunityForensics-DeepfakeDet-ViT](https://huggingface.co/buildborderless/CommunityForensics-DeepfakeDet-ViT) | AI-generated images and video frames | MIT | Main image/video detector (80% weight); a Vision Transformer trained on images from thousands of generators |
| [prithivMLmods/AI-vs-Deepfake-vs-Real-ONNX](https://huggingface.co/prithivMLmods/AI-vs-Deepfake-vs-Real-ONNX) | "Artificial" images | Apache-2.0 | Second opinion (20% weight), int8 |
| [pranjal-pravesh/wav2vec2-large-xlsr-deepfake-audio-classification](https://huggingface.co/pranjal-pravesh/wav2vec2-large-xlsr-deepfake-audio-classification) | Cloned or synthetic voices | Apache-2.0 | Voice check and Live Call Guard; 4-second chunks, median score, int8 |

### How the score is combined
- AI models give about **85%** of the score and forensic checks about **15%**.
- For video, frames count for half, audio for a quarter.
- When signals disagree or the file is heavily compressed, the **range widens** and the result moves to
  *Inconclusive* instead of guessing.
- Bands: below 35% *Likely authentic*, above 65% *Likely manipulated*, in between *Inconclusive*.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS, shadcn/ui, Recharts, Wavesurfer.js, react-dropzone, Axios |
| Backend | Node.js 24, Express 5, Multer, FFmpeg (fluent-ffmpeg), ExifTool (exiftool-vendored), ONNX Runtime, Helmet |
| Database | MongoDB (Mongoose), MongoDB Atlas in the cloud |
| Live audio | Browser AudioWorklet → 16 kHz float32 chunks → `/api/live/chunk` |

## Project structure

```
deepfake-detector/
├── backend/
│   ├── scripts/download-models.mjs   # fetches the pinned ONNX models
│   └── src/
│       ├── config/                   # env, database
│       ├── controllers/              # scans, messages
│       ├── middleware/               # uploads, rate limits, errors
│       ├── models/                   # Scan, Message (Mongoose)
│       ├── routes/                   # /api/scans, /api/messages, /api/live
│       └── services/
│           ├── detectors/            # ONNX models
│           ├── forensics/            # ELA, spectrum, timing, audio, C2PA, fingerprints
│           ├── messages/             # text signals, link analysis, safe fetching
│           ├── pipeline.js           # the scan pipeline
│           └── scoring.js            # bands and confidence ranges
├── frontend/
│   └── src/
│       ├── pages/                    # Dashboard, checks, results, Live Call Guard, History…
│       ├── components/
│       └── lib/                      # API client, live audio, verdict logic
├── scripts/deploy-space.mjs
├── Dockerfile
└── DEPLOY.md
```

## Getting started

**Requirements:** Node.js 24, FFmpeg on your PATH (or set `FFMPEG_PATH` / `FFPROBE_PATH`), and MongoDB (local or
Atlas).

```bash
git clone https://github.com/sanchiii15/hackerwrath3.git
cd hackerwrath3
cp backend/.env.example backend/.env   # then set MONGODB_URI
npm run setup                          # installs packages and downloads the models
```

### Development
```bash
npm run dev      # API on http://localhost:5000, app on http://localhost:5173
```

### One server (demo / production)
```bash
npm start        # builds the frontend and serves app + API on http://localhost:5000
```
Set `SERVE_FRONTEND=true` in `backend/.env` (or `NODE_ENV=production`). To share it publicly, put a tunnel in front,
for example `ngrok http 5000`, and set `TRUST_PROXY=1`.

Check that everything loaded: `http://localhost:5000/api/health` should show `"db":"connected"` and
`"detector":"onnx"`.

### Docker
The `Dockerfile` builds one container with FFmpeg, the frontend and the models. It needs about 2 GB of RAM. See
[DEPLOY.md](DEPLOY.md).

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/scans` | Upload a file (`file` field) and scan it |
| `GET` | `/api/scans` · `/api/scans/:id` | List scans · get one result |
| `GET` | `/api/scans/stats` | Totals for the dashboard |
| `GET` | `/api/scans/:id/report` | Download a scan report (JSON) |
| `POST` | `/api/scans/:id/feedback` | Mark a verdict right or wrong |
| `DELETE` | `/api/scans/:id` | Delete a scan |
| `POST` | `/api/messages` | Check a message's text and links |
| `GET` | `/api/messages` · `/api/messages/:id` | List checks · get one result |
| `DELETE` | `/api/messages/:id` | Delete a message check |
| `POST` | `/api/live/chunk` | Score 4 s of 16 kHz audio (Live Call Guard) |
| `GET` | `/api/health` | Database and detector status |

## Limitations

No deepfake detector is perfect. Heavy compression, very short clips, phone speakers and brand-new generators all
reduce accuracy. That is why results come as ranges with an *Inconclusive* band, and why the app should support a
decision, not replace it. When in doubt, verify through another channel and report fraud on **1930**.

## Roadmap

- **WhatsApp bot:** forward a suspicious video, voice note or message and get a verdict in the chat
- **Browser extension:** an "Is this real?" button on YouTube, Instagram and X
- **Android call screening:** Live Call Guard built into the dialler, on-device
- **Lip-sync analysis** to catch dubbed deepfake videos, and **heatmaps** showing which region looks manipulated
- **Indian languages:** voice models fine-tuned on Hindi, Tamil, Bengali and more; scam detection in Hinglish
- **AI watermark detection** (e.g. SynthID) as generators adopt it
- **Real-time deepfake detection for video calls** ("digital arrest" scams)
- **Shared scam intelligence:** reported numbers, links and deepfake fingerprints that warn everyone who checks later
- **One-click reporting** to cybercrime.gov.in with the evidence attached
- **API for banks and video KYC**, and C2PA signing so creators can prove their content is real

## Acknowledgements

Thanks to the authors of the open models above, and to the FFmpeg, ExifTool and ONNX Runtime projects.
