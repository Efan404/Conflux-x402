export type ClientPayRecordType = 'payment' | 'refund' | 'auth' | 'settings'
export type ClientPayRecordStatus = 'success' | 'failed' | 'pending'

export interface ClientPaySettings {
  perTxLimit: number
  monthlyBudget: number
}

export interface ClientPaySpend {
  dailySpent: number
  monthlySpent: number
}

export interface ClientPayRecord {
  id: string
  wallet: string
  type: ClientPayRecordType
  amount: number
  asset: 'USDT0'
  status: ClientPayRecordStatus
  createdAt: string
  txHash?: string
  note?: string
}

export interface ClientPayState {
  settings: ClientPaySettings
  spend: ClientPaySpend
  records: ClientPayRecord[]
  updatedAt: string
}

const STORAGE_PREFIX = 'x402.clientpay'

export const DEFAULT_CLIENT_PAY_SETTINGS: ClientPaySettings = {
  perTxLimit: 50,
  monthlyBudget: 500,
}

export const DEFAULT_CLIENT_PAY_SPEND: ClientPaySpend = {
  dailySpent: 125.6,
  monthlySpent: 125.6,
}

function storageKey(wallet: string): string {
  return `${STORAGE_PREFIX}:${wallet.toLowerCase()}`
}

function nowIso(): string {
  return new Date().toISOString()
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function createDemoClientPayState(wallet: string = 'demo-wallet'): ClientPayState {
  return {
    settings: { ...DEFAULT_CLIENT_PAY_SETTINGS },
    spend: { ...DEFAULT_CLIENT_PAY_SPEND },
    records: [
      {
        id: generateId(),
        wallet: wallet.toLowerCase(),
        type: 'payment',
        amount: 125.6,
        asset: 'USDT0',
        status: 'success',
        createdAt: nowIso(),
        note: 'Demo payment',
      },
    ],
    updatedAt: nowIso(),
  }
}

function sanitizeNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return Number(parsed.toFixed(4))
}

function sanitizeState(raw: Partial<ClientPayState>, wallet: string): ClientPayState {
  const settings: Partial<ClientPaySettings> = raw.settings || {}
  const spend: Partial<ClientPaySpend> = raw.spend || {}
  const records = Array.isArray(raw.records) ? raw.records : []

  return {
    settings: {
      perTxLimit: sanitizeNumber(settings.perTxLimit, DEFAULT_CLIENT_PAY_SETTINGS.perTxLimit),
      monthlyBudget: sanitizeNumber(settings.monthlyBudget, DEFAULT_CLIENT_PAY_SETTINGS.monthlyBudget),
    },
    spend: {
      dailySpent: sanitizeNumber(spend.dailySpent, DEFAULT_CLIENT_PAY_SPEND.dailySpent),
      monthlySpent: sanitizeNumber(spend.monthlySpent, DEFAULT_CLIENT_PAY_SPEND.monthlySpent),
    },
    records: records.filter(Boolean).map((record) => ({
      id: typeof record.id === 'string' ? record.id : generateId(),
      wallet: typeof record.wallet === 'string' ? record.wallet : wallet.toLowerCase(),
      type: (record.type as ClientPayRecordType) || 'payment',
      amount: sanitizeNumber(record.amount, 0),
      asset: 'USDT0',
      status: (record.status as ClientPayRecordStatus) || 'success',
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : nowIso(),
      txHash: typeof record.txHash === 'string' ? record.txHash : undefined,
      note: typeof record.note === 'string' ? record.note : undefined,
    })),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : nowIso(),
  }
}

export function loadClientPayState(wallet: string): ClientPayState {
  if (typeof window === 'undefined') return createDemoClientPayState(wallet)

  try {
    const raw = window.localStorage.getItem(storageKey(wallet))
    if (!raw) return createDemoClientPayState(wallet)

    const parsed = JSON.parse(raw) as Partial<ClientPayState>
    return sanitizeState(parsed, wallet)
  } catch {
    return createDemoClientPayState(wallet)
  }
}

export function saveClientPayState(wallet: string, state: ClientPayState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(wallet), JSON.stringify(state))
}

export function saveClientPaySettings(wallet: string, settings: ClientPaySettings): ClientPayState {
  const current = loadClientPayState(wallet)
  const next: ClientPayState = {
    ...current,
    settings: {
      perTxLimit: sanitizeNumber(settings.perTxLimit, current.settings.perTxLimit),
      monthlyBudget: sanitizeNumber(settings.monthlyBudget, current.settings.monthlyBudget),
    },
    updatedAt: nowIso(),
  }
  saveClientPayState(wallet, next)
  return next
}

export function appendClientPayRecord(wallet: string, record: Omit<ClientPayRecord, 'id' | 'wallet'>): ClientPayState {
  const current = loadClientPayState(wallet)
  const normalizedRecord: ClientPayRecord = {
    ...record,
    id: generateId(),
    wallet: wallet.toLowerCase(),
    amount: sanitizeNumber(record.amount, 0),
    createdAt: record.createdAt || nowIso(),
    asset: 'USDT0',
  }

  const nextSpend = { ...current.spend }
  if (normalizedRecord.status === 'success' && normalizedRecord.amount > 0) {
    nextSpend.dailySpent = Number((nextSpend.dailySpent + normalizedRecord.amount).toFixed(4))
    nextSpend.monthlySpent = Number((nextSpend.monthlySpent + normalizedRecord.amount).toFixed(4))
  }

  const next: ClientPayState = {
    ...current,
    spend: nextSpend,
    records: [normalizedRecord, ...current.records].slice(0, 200),
    updatedAt: nowIso(),
  }

  saveClientPayState(wallet, next)
  return next
}

export function computeRemainingQuota(state: ClientPayState): number {
  return Math.max(Number((state.settings.monthlyBudget - state.spend.monthlySpent).toFixed(4)), 0)
}
