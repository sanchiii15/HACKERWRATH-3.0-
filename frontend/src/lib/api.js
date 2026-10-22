import axios from 'axios'

// In dev, Vite proxies /api to the backend. Set VITE_API_URL to call another host.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// 502/503/504 come from the Vite proxy when the Express server isn't running.
const BACKEND_DOWN = "Can't reach the backend server. Start it with \"npm --prefix backend run dev\" (MongoDB must be running)."

function errorMessage(err) {
  const status = err.response?.status
  if (!err.response || status === 502 || status === 503 || status === 504) return BACKEND_DOWN
  return err.response.data?.error || err.message || 'Request failed'
}

async function call(promise) {
  try {
    const res = await promise
    return res.data
  } catch (err) {
    throw new Error(errorMessage(err))
  }
}

export function uploadScan(file, { onProgress, force = false } = {}) {
  const form = new FormData()
  form.append('file', file)
  return call(
    api.post('/scans', form, {
      params: force ? { force: true } : undefined,
      onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
    }),
  )
}

export const getStats = () => call(api.get('/scans/stats'))
export const checkMessage = (text) => call(api.post('/messages', { text }, { timeout: 60000 }))
export const getMessage = (id) => call(api.get(`/messages/${id}`))
export const sendFeedback = (id, body) => call(api.post(`/scans/${id}/feedback`, body))
export const reportUrl = (id) => `${api.defaults.baseURL}/scans/${id}/report`
export const getScan =(id) => call(api.get(`/scans/${id}`))
export const listScans = (params) => call(api.get('/scans', { params }))
export const deleteScan = (id) => call(api.delete(`/scans/${id}`))
export const getHealth = () => call(api.get('/health'))
