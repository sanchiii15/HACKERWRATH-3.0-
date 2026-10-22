import { AudioLines, Image, Video } from 'lucide-react'

// Per-media-type copy and upload rules for the dashboard and checker pages.
export const MEDIA_TYPES = {
  video: {
    key: 'video',
    label: 'Video check',
    noun: 'video',
    icon: Video,
    accept: { 'video/*': ['.mp4', '.mov', '.webm', '.mkv', '.avi'] },
    formats: 'MP4, MOV, WebM, MKV',
    tagline: 'Fake video calls, face swaps and lip-synced clips',
    checks: [
      'Full-clip detector on the original and three re-encoded copies',
      'Up to 24 sampled frames scored individually, with timestamps',
      'Soundtrack extracted and screened for voice cloning',
      'Container, codec and metadata inspection',
    ],
    detects: ['Face swap', 'Lip-sync / face reenactment', 'Fully AI-generated video', 'Edited or spliced footage'],
  },
  image: {
    key: 'image',
    label: 'Image check',
    noun: 'image',
    icon: Image,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    formats: 'JPG, PNG, WebP, HEIC',
    tagline: 'AI-generated photos, swapped faces and edited documents',
    checks: [
      'Image detector on the original and on compressed and resized copies',
      'EXIF and AI generator tag inspection (Stable Diffusion, Midjourney, DALL·E…)',
      'Camera metadata presence check',
    ],
    detects: ['Fully AI-generated image', 'Face swap', 'Edited or spliced image'],
  },
  audio: {
    key: 'audio',
    label: 'Voice check',
    noun: 'audio',
    icon: AudioLines,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.opus', '.webm', '.flac'] },
    formats: 'MP3, WAV, M4A, OGG, FLAC',
    tagline: 'Cloned voices in calls, voice notes and voicemails',
    checks: [
      'Voice detector on the original recording',
      'Re-tested as phone-quality (8 kHz), MP3 and VoIP-style (Opus) audio',
      'Flagged segments shown on a waveform and spectrogram',
    ],
    detects: ['Voice clone', 'Synthetic speech (TTS)', 'Edited or spliced audio'],
  },
}

export const MEDIA_TYPE_LIST = Object.values(MEDIA_TYPES)
