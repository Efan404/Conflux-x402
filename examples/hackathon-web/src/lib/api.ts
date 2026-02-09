export interface JsonResponse<T = unknown> {
  status: number
  ok: boolean
  headers: Record<string, string>
  data: T | null
  rawText: string
}

const sandboxBase = (import.meta.env.VITE_API_SANDBOX_BASE || '/api/sandbox').trim()
const facilitatorBase = (import.meta.env.VITE_API_FACILITATOR_BASE || '/api/facilitator').trim()
const attestorBase = (import.meta.env.VITE_API_ATTESTOR_BASE || '/api/attestor').trim()

function joinBase(base: string, suffix: string): string {
  if (!suffix) return base
  return `${base.replace(/\/$/, '')}${suffix}`
}

function resolveApiUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url
  // In Vite dev, always keep same-origin /api/* so requests go through proxy and avoid browser CORS.
  if (import.meta.env.DEV && url.startsWith('/api/')) return url

  if (url.startsWith('/api/sandbox')) {
    return joinBase(sandboxBase, url.slice('/api/sandbox'.length))
  }

  if (url.startsWith('/api/facilitator')) {
    return joinBase(facilitatorBase, url.slice('/api/facilitator'.length))
  }

  if (url.startsWith('/api/attestor')) {
    return joinBase(attestorBase, url.slice('/api/attestor'.length))
  }

  return url
}

export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<JsonResponse<T>> {
  const response = await fetch(resolveApiUrl(url), init)
  const headers: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    headers[key] = value
  })

  const rawText = await response.text()
  let data: T | null = null
  if (rawText) {
    try {
      data = JSON.parse(rawText) as T
    } catch {
      data = null
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    headers,
    data,
    rawText,
  }
}

export function shortJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
