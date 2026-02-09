import assert from 'node:assert/strict'
import http from 'node:http'
import test from 'node:test'
import express from 'express'
import { createDemoRouter } from '../dist/routes/demo.js'

const realFetch = globalThis.fetch

function createConfig(overrides = {}) {
  return {
    port: 4021,
    facilitatorUrl: 'http://facilitator.local',
    evmAddress: '0x1111111111111111111111111111111111111111',
    paymentEnabled: true,
    authMode: 'none',
    rpcUrl: 'https://evm.confluxrpc.com',
    chainId: 1030,
    refundDefault: 'off',
    ...overrides,
  }
}

function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app)
    server.listen(0, () => {
      const port = server.address().port
      realFetch(`http://localhost:${port}${path}`)
        .then(async (res) => {
          const body = await res.json()
          resolve({ status: res.status, body })
          server.close()
        })
        .catch((error) => {
          server.close()
          reject(error)
        })
    })
  })
}

test('demo router proxies discovery resources', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url, options = {}) => {
    assert.equal(url, 'http://facilitator.local/discovery/resources?capability=chart-generation')
    assert.equal(options.headers['X-API-Key'], 'demo-key')
    return new Response(
      JSON.stringify({
        resources: [{ name: 'Chart Agent', routes: [{ path: '/chart/render' }] }],
        total: 1,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  }

  try {
    const app = express()
    app.use('/demo/api', createDemoRouter(createConfig({ facilitatorApiKey: 'demo-key' })))

    const result = await request(
      app,
      '/demo/api/discovery/resources?capability=chart-generation',
    )
    assert.equal(result.status, 200)
    assert.equal(result.body.ok, true)
    assert.equal(result.body.data.total, 1)
    assert.equal(result.body.data.resources[0].name, 'Chart Agent')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('demo router returns 503 when facilitator is unavailable', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => {
    throw new Error('connection refused')
  }

  try {
    const app = express()
    app.use('/demo/api', createDemoRouter(createConfig()))

    const result = await request(app, '/demo/api/facilitator/health')
    assert.equal(result.status, 503)
    assert.equal(result.body.ok, false)
    assert.match(result.body.error, /connection refused/)
  } finally {
    globalThis.fetch = originalFetch
  }
})
