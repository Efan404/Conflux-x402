export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
}

export const CONFLUX_ESPACE_CHAIN_ID = 1030
export const CONFLUX_ESPACE_CHAIN_ID_HEX = '0x406'

const CONFLUX_ESPACE_PARAMS = {
  chainId: CONFLUX_ESPACE_CHAIN_ID_HEX,
  chainName: 'Conflux eSpace',
  nativeCurrency: {
    name: 'CFX',
    symbol: 'CFX',
    decimals: 18,
  },
  rpcUrls: [
    'https://evm.confluxrpc.com',
    'https://evmmain-global.confluxrpc.com',
  ],
  blockExplorerUrls: ['https://evm.confluxscan.org'],
}

function normalizeChainId(value: string): string {
  try {
    return `0x${BigInt(value).toString(16)}`
  } catch {
    return value.toLowerCase()
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return fallback
}

export async function ensureConfluxESpaceNetwork(
  provider: Eip1193Provider,
): Promise<void> {
  const chainIdRaw = await provider.request({ method: 'eth_chainId' })
  const current = String(chainIdRaw || '').toLowerCase()

  if (normalizeChainId(current) === CONFLUX_ESPACE_CHAIN_ID_HEX) {
    return
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CONFLUX_ESPACE_CHAIN_ID_HEX }],
    })
    return
  } catch (error) {
    const code = (error as { code?: number } | null)?.code
    if (code === 4001) {
      throw new Error('User rejected switching network to Conflux eSpace (1030).')
    }

    if (code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [CONFLUX_ESPACE_PARAMS],
        })
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CONFLUX_ESPACE_CHAIN_ID_HEX }],
        })
        return
      } catch (addError) {
        throw new Error(errorMessage(addError, 'Failed to add/switch Conflux eSpace network.'))
      }
    }

    throw new Error(errorMessage(error, 'Failed to switch network to Conflux eSpace.'))
  }
}

