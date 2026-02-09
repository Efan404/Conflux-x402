const state = {
  mode: 'live',
  reasons: [],
  selectedResource: null,
}

const fallbackSnapshots = {
  paywall: {
    step: 'fallback',
    response: {
      report: {
        city: 'Conflux City',
        weather: 'sunny',
        temperature: 25,
        unit: 'celsius',
      },
    },
    headers: {
      'payment-response': 'fallback-snapshot (demo)',
      'x-transaction': '0xdemo_fallback_tx',
    },
  },
  discoveryResource: {
    name: 'Chart Agent (Local Snapshot)',
    description: 'Fallback resource when facilitator discovery is unavailable',
    endpoint: window.location.origin,
    capabilities: ['chart-generation'],
    accepts: {
      scheme: 'exact',
      network: 'eip155:1030',
      asset: 'USDT0',
      amount: '1000',
      payTo: '0x0000000000000000000000000000000000000000',
    },
    routes: [
      {
        path: '/chart/render',
        method: 'GET',
        description: 'Render chart from sample data',
      },
    ],
  },
}

const views = document.querySelectorAll('.view')
const navButtons = document.querySelectorAll('.nav-btn')
const modeBadge = document.getElementById('modeBadge')
const sandboxBadge = document.getElementById('sandboxBadge')
const facilitatorBadge = document.getElementById('facilitatorBadge')

function setActiveView(viewId) {
  views.forEach((view) => {
    view.classList.toggle('is-active', view.id === `view-${viewId}`)
  })
  navButtons.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.view === viewId)
  })
}

function setBadge(el, text, cls) {
  if (!el) return
  el.textContent = text
  el.className = `badge ${cls}`
}

function pretty(value) {
  return JSON.stringify(value, null, 2)
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const raw = await response.text()
  let json
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    json = { raw }
  }
  return { response, json }
}

function renderTimeline(targetId, items) {
  const target = document.getElementById(targetId)
  target.innerHTML = ''
  for (const item of items) {
    const li = document.createElement('li')
    li.className = item.status
    li.innerHTML = `<strong>${item.title}</strong><div>${item.detail}</div>`
    target.appendChild(li)
  }
}

function renderChartPreview(payload) {
  const container = document.getElementById('chartPreview')
  if (!payload?.data?.values || !payload?.data?.labels) {
    container.textContent = 'No chart payload.'
    return
  }

  const values = payload.data.values
  const labels = payload.data.labels
  const max = Math.max(...values, 1)

  const bars = values
    .map((v, idx) => {
      const height = Math.max(8, Math.round((v / max) * 120))
      return `<div class="chart-bar" style="height:${height}px" title="${labels[idx]}: ${v}"><span>${labels[idx]}</span></div>`
    })
    .join('')

  container.innerHTML = `<div class="chart-bars">${bars}</div>`
}

async function bootstrapHealth() {
  const reasons = []

  const checks = await Promise.allSettled([
    fetchJson('/health'),
    fetchJson('/demo/api/facilitator/health'),
  ])

  const sandboxResult = checks[0]
  if (sandboxResult.status === 'fulfilled' && sandboxResult.value.response.ok) {
    setBadge(sandboxBadge, 'Sandbox: healthy', 'badge badge-live')
  } else {
    setBadge(sandboxBadge, 'Sandbox: degraded', 'badge badge-degraded')
    reasons.push('sandbox health unavailable')
  }

  const facilitatorResult = checks[1]
  if (facilitatorResult.status === 'fulfilled' && facilitatorResult.value.response.ok) {
    setBadge(facilitatorBadge, 'Facilitator: healthy', 'badge badge-live')
  } else {
    setBadge(facilitatorBadge, 'Facilitator: unavailable', 'badge badge-degraded')
    reasons.push('facilitator health unavailable')
  }

  state.mode = reasons.length > 0 ? 'fallback' : 'live'
  state.reasons = reasons

  if (state.mode === 'live') {
    setBadge(modeBadge, 'Mode: LIVE', 'badge badge-live')
  } else {
    setBadge(modeBadge, `Mode: FALLBACK (${reasons.join(', ')})`, 'badge badge-fallback')
  }
}

async function runPaywallFlow() {
  const inspector = document.getElementById('paywallInspector')
  const steps = [
    { title: '1. Request sent', status: 'pending', detail: 'Calling GET /sandbox/weather' },
    { title: '2. Payment challenge', status: 'pending', detail: 'Waiting for 402 response' },
    { title: '3. Settlement context', status: 'pending', detail: 'Live if available; fallback snapshot otherwise' },
    { title: '4. Protected data response', status: 'pending', detail: 'Expected 200 response payload' },
  ]
  renderTimeline('paywallTimeline', steps)

  try {
    const first = await fetchJson('/sandbox/weather')
    steps[0] = { ...steps[0], status: 'success', detail: `HTTP ${first.response.status}` }

    if (first.response.status === 402) {
      steps[1] = { ...steps[1], status: 'success', detail: 'Payment required detected (402)' }
      steps[2] = {
        ...steps[2],
        status: 'pending',
        detail: state.mode === 'live'
          ? 'Browser walletless mode: using demo snapshot for settlement visualization'
          : 'Fallback snapshot active',
      }

      steps[3] = { ...steps[3], status: 'success', detail: 'Rendered from fallback success snapshot (200-equivalent)' }
      renderTimeline('paywallTimeline', steps)

      inspector.textContent = pretty({
        mode: state.mode,
        firstResponse: {
          status: first.response.status,
          headers: {
            'payment-required': first.response.headers.get('payment-required'),
            'x-request-id': first.response.headers.get('x-request-id'),
          },
          body: first.json,
        },
        settlementVisualization: fallbackSnapshots.paywall,
      })
      return
    }

    if (first.response.ok) {
      steps[1] = { ...steps[1], status: 'success', detail: 'No payment challenge in current env' }
      steps[2] = { ...steps[2], status: 'success', detail: 'Settlement skipped (payment disabled or already handled)' }
      steps[3] = { ...steps[3], status: 'success', detail: 'Live response returned' }
      renderTimeline('paywallTimeline', steps)
      inspector.textContent = pretty({
        mode: state.mode,
        live: true,
        response: {
          status: first.response.status,
          body: first.json,
        },
      })
      return
    }

    steps[1] = { ...steps[1], status: 'failed', detail: `Unexpected status: ${first.response.status}` }
    steps[2] = { ...steps[2], status: 'failed', detail: 'Flow interrupted' }
    steps[3] = { ...steps[3], status: 'failed', detail: 'No protected data' }
    renderTimeline('paywallTimeline', steps)
    inspector.textContent = pretty({ error: 'unexpected response', status: first.response.status, body: first.json })
  } catch (error) {
    steps[0] = { ...steps[0], status: 'failed', detail: 'Request failed' }
    steps[1] = { ...steps[1], status: 'failed', detail: 'No response from endpoint' }
    steps[2] = { ...steps[2], status: 'pending', detail: 'Using fallback settlement snapshot' }
    steps[3] = { ...steps[3], status: 'success', detail: 'Fallback payload shown' }
    renderTimeline('paywallTimeline', steps)
    inspector.textContent = pretty({
      error: error instanceof Error ? error.message : 'unknown',
      fallback: fallbackSnapshots.paywall,
    })
  }
}

function normalizeResources(payload) {
  if (payload?.ok && payload.data?.resources) {
    return payload.data.resources
  }
  if (payload?.resources) {
    return payload.resources
  }
  return []
}

function renderResources(resources) {
  const list = document.getElementById('resourceList')
  list.innerHTML = ''

  if (!resources.length) {
    list.innerHTML = '<p class="hint">No resources found.</p>'
    return
  }

  resources.forEach((resource, index) => {
    const el = document.createElement('button')
    el.className = `resource-item${index === 0 ? ' is-selected' : ''}`
    el.type = 'button'
    el.innerHTML = `
      <strong>${resource.name || `Agent ${resource.agentId || ''}`}</strong>
      <div>${resource.description || 'No description'}</div>
      <div class="hint">Capability: ${(resource.capabilities || []).join(', ') || 'n/a'}</div>
      <div class="hint">Price: ${resource.accepts?.amount || 'n/a'}</div>
    `

    el.addEventListener('click', () => {
      list.querySelectorAll('.resource-item').forEach((item) => item.classList.remove('is-selected'))
      el.classList.add('is-selected')
      state.selectedResource = resource
      document.getElementById('discoveryInspector').textContent = pretty({ selected: resource })
    })

    list.appendChild(el)
  })

  state.selectedResource = resources[0]
}

async function loadDiscovery() {
  const inspector = document.getElementById('discoveryInspector')

  try {
    const primary = await fetchJson('/demo/api/discovery/resources?capability=chart-generation&limit=20&offset=0')
    if (primary.response.ok) {
      const resources = normalizeResources(primary.json)
      if (resources.length > 0) {
        renderResources(resources)
        inspector.textContent = pretty({ mode: 'live', source: 'facilitator', payload: primary.json })
        return
      }
    }
  } catch {
    // fallback below
  }

  try {
    const local = await fetchJson('/.well-known/x402-bazaar.json')
    const mapped = {
      ...fallbackSnapshots.discoveryResource,
      name: local.json?.name || fallbackSnapshots.discoveryResource.name,
      description: local.json?.description || fallbackSnapshots.discoveryResource.description,
      capabilities: local.json?.capabilities || fallbackSnapshots.discoveryResource.capabilities,
      routes: local.json?.routes || fallbackSnapshots.discoveryResource.routes,
    }
    renderResources([mapped])
    inspector.textContent = pretty({ mode: 'fallback', source: 'local-well-known', payload: mapped })
  } catch (error) {
    renderResources([])
    inspector.textContent = pretty({ error: error instanceof Error ? error.message : 'failed to load resources' })
  }
}

async function callSelectedAgent() {
  const inspector = document.getElementById('discoveryInspector')
  const selected = state.selectedResource
  if (!selected) {
    inspector.textContent = 'No resource selected.'
    return
  }

  const route = selected.routes?.[0]
  if (!route?.path) {
    inspector.textContent = pretty({ error: 'Selected resource has no callable route' })
    return
  }

  const chartType = document.getElementById('chartType').value
  const endpoint = (selected.endpoint || window.location.origin).replace(/\/$/, '')
  const url = `${endpoint}${route.path}?type=${encodeURIComponent(chartType)}`

  try {
    const result = await fetchJson(url)
    inspector.textContent = pretty({
      request: { url },
      response: {
        status: result.response.status,
        body: result.json,
      },
    })

    if (result.response.ok) {
      renderChartPreview(result.json)
    } else {
      document.getElementById('chartPreview').textContent = 'Agent call failed. See inspector.'
    }
  } catch (error) {
    inspector.textContent = pretty({
      request: { url },
      error: error instanceof Error ? error.message : 'agent call failed',
    })
  }
}

async function triggerRefundFlow() {
  const inspector = document.getElementById('refundInspector')
  const requestIdEl = document.getElementById('refundRequestId')

  const steps = [
    { title: '1. Trigger business failure', status: 'pending', detail: 'GET /sandbox/weather?demo_refund=1' },
    { title: '2. Capture requestId', status: 'pending', detail: 'Read X-Request-Id header' },
    { title: '3. Poll refund record', status: 'pending', detail: 'GET /refunds/:requestId' },
    { title: '4. Final state', status: 'pending', detail: 'settled or failed' },
  ]
  renderTimeline('refundTimeline', steps)

  try {
    const trigger = await fetchJson('/sandbox/weather?demo_refund=1')
    const requestId = trigger.response.headers.get('x-request-id')

    steps[0] = { ...steps[0], status: 'success', detail: `Triggered with HTTP ${trigger.response.status}` }

    if (!requestId) {
      steps[1] = { ...steps[1], status: 'failed', detail: 'x-request-id header missing' }
      steps[2] = { ...steps[2], status: 'failed', detail: 'Cannot poll without requestId' }
      steps[3] = { ...steps[3], status: 'failed', detail: 'Flow ended early' }
      renderTimeline('refundTimeline', steps)
      inspector.textContent = pretty({
        error: 'missing request id',
        response: trigger.json,
      })
      requestIdEl.textContent = 'N/A'
      return
    }

    steps[1] = { ...steps[1], status: 'success', detail: `requestId: ${requestId}` }
    requestIdEl.textContent = requestId
    renderTimeline('refundTimeline', steps)

    let last = null
    let settled = false

    for (let i = 0; i < 20; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const poll = await fetchJson(`/refunds/${encodeURIComponent(requestId)}`)
      if (poll.response.status === 404) {
        continue
      }
      last = poll.json
      steps[2] = { ...steps[2], status: 'success', detail: `State: ${poll.json.state || 'unknown'}` }
      if (poll.json.state === 'settled' || poll.json.state === 'refund_failed') {
        settled = true
        steps[3] = {
          ...steps[3],
          status: poll.json.state === 'settled' ? 'success' : 'failed',
          detail: `Final state: ${poll.json.state}`,
        }
        renderTimeline('refundTimeline', steps)
        break
      }
      renderTimeline('refundTimeline', steps)
    }

    if (!settled) {
      steps[3] = { ...steps[3], status: 'pending', detail: 'No terminal state yet (timeout in demo window)' }
      renderTimeline('refundTimeline', steps)
    }

    inspector.textContent = pretty({
      trigger: {
        status: trigger.response.status,
        body: trigger.json,
      },
      latestRecord: last,
    })
  } catch (error) {
    steps[0] = { ...steps[0], status: 'failed', detail: 'Trigger request failed' }
    steps[1] = { ...steps[1], status: 'failed', detail: 'No requestId' }
    steps[2] = { ...steps[2], status: 'failed', detail: 'Polling skipped' }
    steps[3] = { ...steps[3], status: 'failed', detail: 'No refund state available' }
    renderTimeline('refundTimeline', steps)

    inspector.textContent = pretty({ error: error instanceof Error ? error.message : 'failed' })
    requestIdEl.textContent = 'N/A'
  }
}

function wireNavigation() {
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => setActiveView(btn.dataset.view))
  })

  document.querySelectorAll('[data-view-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-view-target')
      setActiveView(target)
    })
  })
}

function wireActions() {
  document.getElementById('runPaywallFlow').addEventListener('click', runPaywallFlow)
  document.getElementById('loadResources').addEventListener('click', loadDiscovery)
  document.getElementById('callSelectedAgent').addEventListener('click', callSelectedAgent)
  document.getElementById('triggerRefund').addEventListener('click', triggerRefundFlow)
}

async function main() {
  wireNavigation()
  wireActions()
  await bootstrapHealth()
}

main().catch((error) => {
  setBadge(modeBadge, 'Mode: FALLBACK (bootstrap failed)', 'badge badge-error')
  const message = error instanceof Error ? error.message : String(error)
  document.getElementById('paywallInspector').textContent = pretty({ bootstrapError: message })
})
