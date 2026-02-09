import type { Request, Response } from 'express'

/**
 * Dedicated endpoint to trigger the refund pipeline. Always sets refund headers
 * so that after x402 payment settles, the refund-wrapper will enqueue a refund.
 * Call with payment headers; response includes X-Request-Id for polling GET /refunds/:requestId.
 */
export function refundTriggerHandler(req: Request, res: Response): void {
  res.setHeader('X-Refund-Requested', '1')
  res.setHeader('X-Refund-Status', 'pending')
  if (req.ctx?.requestId) {
    res.setHeader('X-Request-Id', req.ctx.requestId)
  }
  res.json({
    ok: true,
    trigger: 'refund',
    message: 'Refund path triggered; poll GET /refunds/:requestId for status.',
    requestId: req.ctx?.requestId ?? null,
  })
}

export function weatherHandler(req: Request, res: Response): void {
  // Demo mode: simulate business failure for refund demonstration
  if (req.query.demo_refund === '1') {
    res.setHeader('X-Refund-Requested', '1')
    res.setHeader('X-Refund-Status', 'pending')
    if (req.ctx?.requestId) {
      res.setHeader('X-Request-Id', req.ctx.requestId)
    }
    res.json({
      ok: false,
      error: 'SIMULATED_FAILURE',
      message: 'Demo: simulated business failure to trigger refund',
    })
    return
  }

  res.json({
    report: {
      city: 'Conflux City',
      weather: 'sunny',
      temperature: 25,
      unit: 'celsius',
    },
  })
}
