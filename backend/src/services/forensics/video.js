import { ffmpeg, ffprobe } from './ffmpegRaw.js';
import { percentile, clamp01 } from './fft.js';

const MAX_SECONDS = 120;
const SCENE_THRESHOLD = 0.4;

/*
 * Frame timing: dropped, duplicated or re-timed frames show up as irregular gaps
 * between presentation timestamps. Common after splicing or frame interpolation,
 * but also in normal variable-frame-rate phone recordings, so it's supporting evidence only.
 */
export async function frameTiming(input) {
  const { stdout } = await ffprobe([
    '-v', 'error', '-select_streams', 'v:0', '-read_intervals', `%+${MAX_SECONDS}`,
    '-show_entries', 'packet=pts_time', '-of', 'csv=p=0', input,
  ]);
  const times = stdout
    .toString()
    .split(/\r?\n/)
    .map(Number)
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 10) return { frames: times.length, irregularRatio: 0, score: 0, gaps: [] };

  const deltas = [];
  for (let i = 1; i < times.length; i++) deltas.push(times[i] - times[i - 1]);
  const median = percentile(deltas, 50);
  const gaps = [];
  let irregular = 0;
  deltas.forEach((d, i) => {
    if (d > median * 1.8 || d < median * 0.5) {
      irregular++;
      if (d > median * 1.8 && gaps.length < 20) gaps.push({ start: times[i], end: times[i + 1] });
    }
  });
  const irregularRatio = irregular / deltas.length;
  return {
    frames: times.length,
    medianInterval: median,
    measuredFps: median ? 1 / median : undefined,
    irregularRatio,
    gaps,
    score: clamp01(irregularRatio * 10),
  };
}

/*
 * Hard scene cuts. A video call or a single-take statement shouldn't have any;
 * cuts there can mean spliced footage.
 */
export async function sceneCuts(input) {
  const { stderr } = await ffmpeg([
    '-v', 'info', '-t', String(MAX_SECONDS), '-i', input, '-an',
    '-vf', `scale=320:-2,select='gt(scene,${SCENE_THRESHOLD})',showinfo`, '-f', 'null', '-',
  ]);
  const cuts = [...stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1])).filter((t) => t > 0.2);
  return { cuts, count: cuts.length };
}
