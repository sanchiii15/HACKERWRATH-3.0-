# Deepfake Screener: one container serving the API and the built frontend.
# Works on Hugging Face Spaces (Docker SDK, port 7860) and any Docker host.
FROM node:24-bookworm-slim

# FFmpeg for decoding and stress-testing media; Perl for ExifTool (exiftool-vendored on Linux).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg perl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first so they're cached between code changes.
COPY backend/package.json backend/package-lock.json backend/
COPY frontend/package.json frontend/package-lock.json frontend/
RUN npm --prefix backend ci --omit=dev && npm --prefix frontend ci

COPY backend backend
COPY frontend frontend

# Build the frontend, then download the pinned ONNX models (~530 MB) into the image.
RUN npm --prefix frontend run build \
  && npm --prefix backend run models:download \
  && rm -rf frontend/node_modules

# Hugging Face runs containers as uid 1000, which is the "node" user in this image.
RUN mkdir -p backend/uploads backend/tmp && chown -R node:node /app
USER node

ENV NODE_ENV=production \
    PORT=7860
EXPOSE 7860

WORKDIR /app/backend
CMD ["node", "src/server.js"]
