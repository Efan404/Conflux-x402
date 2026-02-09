import { BrowserProvider, ethers } from 'ethers'

const ZERO_BODY_HASH = '0x0000000000000000000000000000000000000000000000000000000000000000'
const SANDBOX_BASE = (import.meta.env.VITE_API_SANDBOX_BASE || '/api/sandbox').trim()
const AUTH_CHAIN_ID = 1030

function resolveSandboxHost(hostOverride?: string): string {
  if (hostOverride) {
    return hostOverride
  }

  if (/^https?:\/\//i.test(SANDBOX_BASE)) {
    return new URL(SANDBOX_BASE).host
  }

  if (import.meta.env.DEV) {
    // Matches vite proxy default target in vite.config.ts when no VITE_API_SANDBOX_BASE is provided.
    return 'localhost:4021'
  }

  return window.location.host
}

function buildCanonicalMessage(params: {
  host: string
  method: string
  path: string
  bodyHash: string
  nonce: string
  expiry: string
}): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      ['string', 'uint256', 'string', 'string', 'string', 'bytes32', 'string', 'string'],
      [
        'X402-AUTH',
        BigInt(AUTH_CHAIN_ID),
        params.host,
        params.method,
        params.path,
        params.bodyHash,
        params.nonce,
        params.expiry,
      ],
    ),
  )
}

function buildBodyHash(method: string, body?: BodyInit | null): string {
  if (method === 'GET' || method === 'HEAD' || body == null) {
    return ZERO_BODY_HASH
  }

  if (typeof body === 'string') {
    return ethers.keccak256(ethers.toUtf8Bytes(body))
  }

  return ZERO_BODY_HASH
}

function createNonce(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function buildSandboxAuthHeaders(params: {
  path: string
  method?: string
  body?: BodyInit | null
  host?: string
}): Promise<Record<string, string>> {
  if (!window.ethereum) {
    throw new Error('MetaMask provider not found')
  }

  const method = (params.method || 'GET').toUpperCase()
  const host = resolveSandboxHost(params.host)
  const nonce = createNonce()
  const expiry = String(Math.floor(Date.now() / 1000) + 60)
  const bodyHash = buildBodyHash(method, params.body)
  const message = buildCanonicalMessage({
    host,
    method,
    path: params.path,
    bodyHash,
    nonce,
    expiry,
  })

  const provider = new BrowserProvider(window.ethereum as never)
  const signer = await provider.getSigner()
  const signature = await signer.signMessage(ethers.getBytes(message))

  return {
    'X-Auth-Signature': signature,
    'X-Auth-Nonce': nonce,
    'X-Auth-Expiry': expiry,
  }
}
