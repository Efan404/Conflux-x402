import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

interface ConnectResult {
  ok: boolean
  error?: string
}

interface WalletContextValue {
  walletAddress: string | null
  isConnected: boolean
  isConnecting: boolean
  isAuthVerified: boolean
  connectWallet: () => Promise<ConnectResult>
  disconnectWallet: () => void
  setAuthVerified: (verified: boolean) => void
}

const WALLET_STORAGE_KEY = 'x402.wallet.address'
const AUTH_STORAGE_KEY = 'x402.wallet.auth'

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase()
}

function readInitialWallet(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return normalizeAddress(window.localStorage.getItem(WALLET_STORAGE_KEY))
  } catch {
    return null
  }
}

function readAuthMap(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, boolean>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeAuthMap(map: Record<string, boolean>): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(map))
}

const WalletContext = createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: ReactNode }) {
  const [walletAddress, setWalletAddress] = useState<string | null>(() => readInitialWallet())
  const [authMap, setAuthMap] = useState<Record<string, boolean>>(() => readAuthMap())
  const [isConnecting, setIsConnecting] = useState(false)

  const connectWallet = async (): Promise<ConnectResult> => {
    if (!window.ethereum) {
      return { ok: false, error: 'MetaMask not found. Please install MetaMask first.' }
    }

    setIsConnecting(true)
    try {
      const accounts = (await window.ethereum.request({
        method: 'eth_requestAccounts',
      })) as string[]
      const nextAddress = normalizeAddress(accounts?.[0])

      if (!nextAddress) {
        return { ok: false, error: 'No account returned by MetaMask.' }
      }

      setWalletAddress(nextAddress)
      window.localStorage.setItem(WALLET_STORAGE_KEY, nextAddress)
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Failed to connect wallet.',
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setWalletAddress(null)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(WALLET_STORAGE_KEY)
    }
  }

  const setAuthVerified = (verified: boolean) => {
    const key = normalizeAddress(walletAddress)
    if (!key) return

    const nextMap = { ...authMap, [key]: verified }
    setAuthMap(nextMap)
    writeAuthMap(nextMap)
  }

  const value = useMemo<WalletContextValue>(() => {
    const key = normalizeAddress(walletAddress)
    return {
      walletAddress: key,
      isConnected: !!key,
      isConnecting,
      isAuthVerified: !!(key && authMap[key]),
      connectWallet,
      disconnectWallet,
      setAuthVerified,
    }
  }, [walletAddress, isConnecting, authMap])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used inside WalletProvider')
  }
  return context
}

