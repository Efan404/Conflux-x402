/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_SANDBOX_BASE?: string
  readonly VITE_API_FACILITATOR_BASE?: string
  readonly VITE_API_ATTESTOR_BASE?: string
  readonly VITE_ZK_VERIFIER_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    ethereum?: unknown
  }
}

export {}
