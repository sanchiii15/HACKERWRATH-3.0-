import axios from 'axios'

// In dev, Vite proxies /api to the backend. Set VITE_API_URL to call another host.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

function errorMessage(err) {
  return err.response?.data?.error || err.message || 'Request failed'
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

export const getScan = (id) => call(api.get(`/scans/${id}`))
export const listScans = (params) => call(api.get('/scans', { params }))
export const deleteScan = (id) => call(api.delete(`/scans/${id}`))
export const getHealth = () => call(api.get('/health'))
