// Downloads the pinned ONNX detector models into backend/models/.
// Usage: npm run models:download   (re-run safely; finished files are skipped)
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { MODELS, modelPath, modelUrl } from '../src/services/detectors/models.js';

const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;

for (const key of Object.keys(MODELS)) {
  const dest = modelPath(key);
  const url = modelUrl(key);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });
  if (!head.ok) throw new Error(`${key}: ${url} returned ${head.status}`);
  const expected = Number(head.headers.get('content-length')) || 0;

  if (fs.existsSync(dest) && fs.statSync(dest).size === expected) {
    console.log(`✓ ${key} already downloaded (${mb(expected)})`);
    continue;
  }

  console.log(`↓ ${key}: ${MODELS[key].repo} (${MODELS[key].license}, ${mb(expected)})`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${key}: download failed with ${res.status}`);

  const tmp = `${dest}.part`;
  let received = 0;
  let lastLog = 0;
  const body = Readable.fromWeb(res.body);
  body.on('data', (chunk) => {
    received += chunk.length;
    if (received - lastLog > 25e6) {
      lastLog = received;
      process.stdout.write(`  ${mb(received)} / ${mb(expected)}\r`);
    }
  });
  await pipeline(body, fs.createWriteStream(tmp));
  if (expected && received !== expected) throw new Error(`${key}: expected ${expected} bytes, got ${received}`);
  fs.renameSync(tmp, dest);
  console.log(`✓ ${key} saved to ${path.relative(process.cwd(), dest)}            `);
}
console.log('All models ready.');
