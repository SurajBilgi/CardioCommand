const trimBaseUrl = (value = '') => value.trim().replace(/\/+$/, '')
const normalizeBaseUrl = (value = '') => {
  const trimmed = trimBaseUrl(value)
  return /your-railway-url/i.test(trimmed) ? '' : trimmed
}

const envApiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || '')
const envWsBaseUrl = normalizeBaseUrl(import.meta.env.VITE_WS_BASE_URL || '')

const runtimeWsBase = typeof window !== 'undefined'
  ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  : ''

export const BASE_URL = envApiBaseUrl || (import.meta.env.DEV ? '/api' : '')
export const WS_BASE = envWsBaseUrl || runtimeWsBase
