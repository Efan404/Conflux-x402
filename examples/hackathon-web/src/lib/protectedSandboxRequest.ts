import type { Address, EIP1193Provider } from 'viem'
import { createWalletClient, custom } from 'viem'
import { toClientEvmSigner } from '@x402/evm'
import { registerExactEvmScheme } from '@x402/evm/exact/client'
import { x402Client } from '@x402/core/client'
import { wrapFetchWithPayment } from '@x402/fetch'
import { buildSandboxAuthHeaders } from './sandboxAuth'
import { ensureConfluxESpaceNetwork, type Eip1193Provider } from './walletNetwork'

interface ProtectedSandboxRequestParams {
  walletAddress: string
  url: string
  method?: string
  body?: BodyInit | null
  headers?: HeadersInit
  requestId?: string
}

export interface ProtectedSandboxResponse {
  status: number
  ok: boolean
  headers: Record<string, string>
  data: unknown | null
  rawText: string
  requestId: string
}

const AUTH_CHAIN_ID = 1030
const AUTH_NETWORK = 'eip155:1030'
const CONFLUX_ESPACE_CHAIN = {
  id: AUTH_CHAIN_ID,
  name: 'Conflux eSpace',
  network: 'conflux-espace',
  nativeCurrency: {
    name: 'CFX',
    symbol: 'CFX',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['https://evm.confluxrpc.com'] },
    public: { http: ['https://evm.confluxrpc.com'] },
  },
} as const

let cachedAddress: string | null = null
let cachedFetchWithPay: typeof fetch | null = null

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toUrlString(input: string | URL | Request): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

function toPathname(url: string): string {
  return new URL(url, window.location.origin).pathname
}

function toSandboxPath(pathname: string): string | null {
  const stripped = pathname.startsWith('/api/sandbox')
    ? pathname.slice('/api/sandbox'.length) || '/'
    : pathname
  return stripped.startsWith('/sandbox/') ? stripped : null
}

function providerOrThrow(): EIP1193Provider {
  if (!window.ethereum) {
    throw new Error('MetaMask provider not found')
  }
  return window.ethereum as unknown as EIP1193Provider
}

function createAuthAwareFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = toUrlString(input)
    const pathname = toPathname(url)
    const sandboxPath = toSandboxPath(pathname)
    const method = (init?.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase()

    const headers = new Headers(input instanceof Request ? input.headers : undefined)
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    }

    if (sandboxPath) {
      // Important: for `/api/sandbox/*` requests in dev, do NOT override host with `localhost:3000`.
      // Vite proxy forwards to upstream host, and server-side canonical message uses upstream Host header.
      const shouldOverrideHost =
        !pathname.startsWith('/api/sandbox') && /^https?:\/\//i.test(url)

      const authHeaders = await buildSandboxAuthHeaders({
        path: sandboxPath,
        method,
        body: init?.body,
        host: shouldOverrideHost ? new URL(url).host : undefined,
      })
      Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value))
    }

    return fetch(input, { ...init, headers })
  }
}

function getFetchWithPay(walletAddress: string): typeof fetch {
  if (cachedFetchWithPay && cachedAddress === walletAddress.toLowerCase()) {
    return cachedFetchWithPay
  }

  const walletClient = createWalletClient({
    account: walletAddress as Address,
    chain: CONFLUX_ESPACE_CHAIN,
    transport: custom(providerOrThrow()),
  })

  const signer = toClientEvmSigner({
    address: walletAddress as Address,
    signTypedData: (args: unknown) =>
      walletClient.signTypedData(args as never),
  })

  const client = new x402Client()
  registerExactEvmScheme(client, {
    signer,
    networks: [AUTH_NETWORK],
  })

  const authAwareFetch = createAuthAwareFetch()
  const fetchWithPay = wrapFetchWithPayment(authAwareFetch, client) as typeof fetch

  cachedAddress = walletAddress.toLowerCase()
  cachedFetchWithPay = fetchWithPay
  return fetchWithPay
}

export async function requestProtectedSandbox(
  params: ProtectedSandboxRequestParams,
): Promise<ProtectedSandboxResponse> {
  const walletAddress = params.walletAddress?.trim()
  if (!walletAddress) {
    throw new Error('Wallet address is required')
  }

  await ensureConfluxESpaceNetwork(providerOrThrow() as Eip1193Provider)

  const fetchWithPay = getFetchWithPay(walletAddress)
  const requestId = params.requestId || randomId()
  const method = (params.method || 'GET').toUpperCase()

  const headers = new Headers(params.headers)
  headers.set('X-Request-Id', requestId)

  const response = await fetchWithPay(params.url, {
    method,
    body: params.body,
    headers,
  })

  const collectedHeaders: Record<string, string> = {}
  response.headers.forEach((value: string, key: string) => {
    collectedHeaders[key] = value
  })

  const rawText = await response.text()
  let data: unknown | null = null
  if (rawText) {
    try {
      data = JSON.parse(rawText) as unknown
    } catch {
      data = null
    }
  }

  return {
    status: response.status,
    ok: response.ok,
    headers: collectedHeaders,
    data,
    rawText,
    requestId: collectedHeaders['x-request-id'] || requestId,
  }
}
