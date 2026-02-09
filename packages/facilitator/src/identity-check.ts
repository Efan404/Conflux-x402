import type { PublicClient } from 'viem'
import type { Logger } from 'pino'

/** Max wait for RPC so verify is not blocked by slow/timeout chain calls. */
const IDENTITY_CHECK_TIMEOUT_MS = 5_000

const IDENTITY_REGISTRY_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'isValid',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getIdentity',
    outputs: [
      { internalType: 'bytes32', name: 'domainHash', type: 'bytes32' },
      { internalType: 'uint64', name: 'issuedAt', type: 'uint64' },
      { internalType: 'uint64', name: 'expiresAt', type: 'uint64' },
      { internalType: 'bool', name: 'valid', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export async function checkIdentity(
  address: string,
  registryAddress: string,
  client: PublicClient,
  logger: Logger
): Promise<{ isValid: boolean; error?: string }> {
  try {
    logger.debug({ address, registryAddress }, 'checking identity on-chain')

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Identity check timed out')), IDENTITY_CHECK_TIMEOUT_MS)
    })
    const isValid = await Promise.race([
      client.readContract({
        address: registryAddress as `0x${string}`,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'isValid',
        args: [address as `0x${string}`],
      }),
      timeoutPromise,
    ])

    if (!isValid) {
      // Get more details for logging
      const identity = await client.readContract({
        address: registryAddress as `0x${string}`,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: 'getIdentity',
        args: [address as `0x${string}`],
      })

      logger.warn(
        {
          address,
          domainHash: identity[0],
          issuedAt: identity[1],
          expiresAt: identity[2],
          valid: identity[3],
        },
        'identity not valid or expired'
      )

      return { isValid: false, error: 'Identity not registered or expired' }
    }

    logger.info({ address }, 'identity check passed')
    return { isValid: true }
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error), address },
      'identity check failed'
    )
    return {
      isValid: false,
      error: `Identity check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    }
  }
}
