import { api } from '@/lib/api'

export const TARGET_RATE = 16000
export const WINDOW_SAMPLES = TARGET_RATE * 4 // the voice model scores 4 s windows
export const HOP_SAMPLES = TARGET_RATE * 2 // a new window every 2 s

// Audio worklet that hands each 128-sample input block to the main thread.
const TAP_WORKLET = `
class Tap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel) this.port.postMessage(channel.slice(0))
    return true
  }
}
registerProcessor('tap', Tap)
`

async function openStream(source) {
  if (source === 'system') {
    if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('This browser can’t capture call audio. Use Chrome or Edge on a computer.')
    // Chrome only offers audio together with a tab, window or screen; the video is dropped at once.
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
    stream.getVideoTracks().forEach((t) => t.stop())
    if (!stream.getAudioTracks().length) {
      throw new Error('No audio was shared. Choose the call’s tab or your screen and turn on “Share audio”.')
    }
    return stream
  }
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser can’t use the microphone.')
  // Raw microphone: echo cancellation and noise suppression make real speech look synthetic.
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  })
}

/*
 * Captures audio from the call (system/tab audio), the microphone, or a file, resamples it
 * to 16 kHz mono and emits overlapping 4 s windows every 2 s.
 * Returns { stop() }. onEnd fires when the shared audio or the file finishes.
 */
export async function startCapture({ source, file, onWindow, onLevel, onEnd }) {
  const stream = source === 'file' ? null : await openStream(source)
  const ctx = new AudioContext()
  const workletUrl = URL.createObjectURL(new Blob([TAP_WORKLET], { type: 'application/javascript' }))
  await ctx.audioWorklet.addModule(workletUrl)
  URL.revokeObjectURL(workletUrl)

  const tap = new AudioWorkletNode(ctx, 'tap')
  // The worklet only runs while connected to the output; a muted gain keeps it silent.
  const mute = ctx.createGain()
  mute.gain.value = 0
  tap.connect(mute).connect(ctx.destination)

  let playback = null
  if (stream) {
    ctx.createMediaStreamSource(stream).connect(tap)
    stream.getAudioTracks()[0].addEventListener('ended', () => onEnd?.())
  } else {
    const buffer = await ctx.decodeAudioData(await file.arrayBuffer())
    playback = ctx.createBufferSource()
    playback.buffer = buffer
    playback.connect(tap)
    playback.connect(ctx.destination) // let the presenter hear the recording
    playback.onended = () => onEnd?.()
    playback.start()
  }

  // Box-filter downsampling to 16 kHz: averages each group of input samples.
  const ratio = ctx.sampleRate / TARGET_RATE
  // Circular buffer holding the latest 4 s at 16 kHz.
  const ring = new Float32Array(WINDOW_SAMPLES)
  let write = 0
  let filled = 0
  let sinceEmit = 0
  let carry = 0
  let acc = 0
  let accCount = 0
  let levelSum = 0
  let levelCount = 0

  tap.port.onmessage = ({ data }) => {
    for (let i = 0; i < data.length; i++) {
      acc += data[i]
      accCount++
      levelSum += data[i] * data[i]
      levelCount++
      carry += 1
      if (carry >= ratio) {
        carry -= ratio
        const sample = acc / accCount
        acc = 0
        accCount = 0
        ring[write] = sample
        write = (write + 1) % WINDOW_SAMPLES
        if (filled < WINDOW_SAMPLES) filled++
        sinceEmit++
        if (filled === WINDOW_SAMPLES && sinceEmit >= HOP_SAMPLES) {
          sinceEmit = 0
          // Unroll the ring so the window is in time order.
          const window = new Float32Array(WINDOW_SAMPLES)
          window.set(ring.subarray(write))
          window.set(ring.subarray(0, write), WINDOW_SAMPLES - write)
          onWindow?.(window)
        }
      }
    }
    if (levelCount >= ctx.sampleRate / 20) {
      onLevel?.(Math.sqrt(levelSum / levelCount))
      levelSum = 0
      levelCount = 0
    }
  }

  return {
    sampleRate: ctx.sampleRate,
    stop() {
      try {
        playback?.stop()
      } catch {
        // already finished
      }
      stream?.getTracks().forEach((t) => t.stop())
      tap.port.onmessage = null
      ctx.close()
    },
  }
}

// Sends one 16 kHz window to the backend; returns { speech, fake, ms }.
export async function scoreWindow(pcm) {
  const res = await api.post('/live/chunk', pcm.buffer, {
    headers: { 'content-type': 'application/octet-stream' },
    timeout: 15000,
  })
  return res.data
}
