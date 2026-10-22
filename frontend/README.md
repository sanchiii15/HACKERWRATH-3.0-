# SurfaceCheck: Suspicious Media Screening (frontend)

React (Vite) frontend. Demo mode works with no backend.

## Run
1. Install Node.js 18+ from nodejs.org
2. In this folder run:  `npm install`
3. Then:  `npm run dev`  and open the address it prints (usually http://localhost:5173)

## Demo mode vs Live mode
- No `.env` file: Demo mode. Results are simulated and labeled as such.
- To use a real detector: copy `.env.example` to `.env` and set `VITE_API_BASE_URL=http://localhost:8000`, then restart `npm run dev`.

## API your detector must provide
POST {BASE}/analyze/video | /analyze/image | /analyze/audio  (multipart form field: `file`)

Return JSON:
{ "id": "abc", "mediaType": "video", "fileName": "clip.mp4", "status": "complete",
  "assessment": "lower | inconclusive | elevated", "score": 0-100,
  "confidenceBand": "low | moderate | high",
  "evidence": [{ "label": "Visual consistency", "flag": "ok | mixed | concern", "detail": "..." }],
  "robustness": { "original": { "score": 82 },
                  "afterCompression": { "score": 55, "method": "H.264 low bitrate, 50% resize" } },
  "detectorVersion": "v0.1", "createdAt": "2026-10-22T10:00:00Z" }

Allow CORS from http://localhost:5173 on the detector.

## Files to know
- src/services/analysisService.js  the only place that talks to the backend (or mock)
- src/lib/fileValidation.js        file type and size checks
- src/components/ResultView.jsx    the results screen
- src/pages/                       one file per page
