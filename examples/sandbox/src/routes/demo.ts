import { Router } from 'express'
import type { ServerConfig } from '../config.js'

interface JsonRecord {
  [key: string]: unknown
}

async function proxyJson(
  url: string,
  config: ServerConfig,
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  try {
    const headers: Record<string, string> = {}
    if (config.facilitatorApiKey) {
      headers['X-API-Key'] = config.facilitatorApiKey
    }

    const response = await fetch(url, { headers })
    const data = (await response.json().catch(() => ({}))) as JsonRecord
    if (!response.ok) {
      const message =
        typeof data.error === 'string'
          ? data.error
          : `upstream request failed (${response.status})`
      return { ok: false, status: response.status, error: message }
    }
    return { ok: true, data }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      error: error instanceof Error ? error.message : 'request failed',
    }
  }
}

export function createDemoRouter(config: ServerConfig): Router {
  const router = Router()

  router.get('/facilitator/health', async (_req, res) => {
    const result = await proxyJson(`${config.facilitatorUrl.replace(/\/$/, '')}/health`, config)
    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error })
      return
    }
    res.json({ ok: true, source: 'facilitator', data: result.data })
  })

  router.get('/facilitator/supported', async (_req, res) => {
    const result = await proxyJson(`${config.facilitatorUrl.replace(/\/$/, '')}/supported`, config)
    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error })
      return
    }
    res.json({ ok: true, source: 'facilitator', data: result.data })
  })

  router.get('/discovery/resources', async (req, res) => {
    const params = new URLSearchParams()
    const limit = req.query.limit
    const offset = req.query.offset
    const capability = req.query.capability

    if (typeof limit === 'string') params.set('limit', limit)
    if (typeof offset === 'string') params.set('offset', offset)
    if (typeof capability === 'string') params.set('capability', capability)

    const query = params.size > 0 ? `?${params.toString()}` : ''
    const result = await proxyJson(
      `${config.facilitatorUrl.replace(/\/$/, '')}/discovery/resources${query}`,
      config,
    )
    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error })
      return
    }
    res.json({ ok: true, source: 'facilitator', data: result.data })
  })

  return router
}
