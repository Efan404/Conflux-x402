import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { BrowserProvider, Contract } from 'ethers'
import {
  CheckCircle,
  Shield,
  Wallet,
  Globe,
  FileText,
  KeyRound,
  Settings,
  List,
} from 'lucide-react'
import { fetchJson, shortJson } from '../lib/api'
import { useWallet } from '../context/WalletContext'
import {
  appendClientPayRecord,
  computeRemainingQuota,
  createDemoClientPayState,
  DEFAULT_CLIENT_PAY_SETTINGS,
  loadClientPayState,
  saveClientPaySettings,
  type ClientPayState,
  type ClientPayRecord,
} from '../lib/clientPayStore'
import {
  CONFLUX_ESPACE_CHAIN_ID,
  ensureConfluxESpaceNetwork,
  type Eip1193Provider,
} from '../lib/walletNetwork'

type TabId = 'auth' | 'budget' | 'records'
type VerifyMethod = 'http' | 'dns'
type RecordFilter = 'all' | 'success' | 'failed'

interface ChallengeResponse {
  challenge: string
  address: string
  domain: string
  method: VerifyMethod
  expiresIn: string
  instructions: string
}

interface AttestResponse {
  signature: string
  domainHash: string
  expiry: number
  challenge: string
  userAddress: string
}

const ZK_VERIFIER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'userAddress', type: 'address' },
      { internalType: 'bytes32', name: 'domainHash', type: 'bytes32' },
      { internalType: 'uint64', name: 'expiry', type: 'uint64' },
      { internalType: 'bytes', name: 'signature', type: 'bytes' },
    ],
    name: 'verifyAndRegister',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

function parseTab(value: string | null): TabId {
  if (value === 'auth' || value === 'budget' || value === 'records') return value
  return 'auth'
}

function formatAmount(value: number): string {
  return value.toFixed(1)
}

export default function AiPayPage() {
  const {
    walletAddress,
    isConnected,
    isConnecting,
    isAuthVerified,
    connectWallet,
    setAuthVerified,
  } = useWallet()

  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTab(searchParams.get('tab')))

  const [clientPayState, setClientPayState] = useState<ClientPayState>(() => createDemoClientPayState())
  const [perTxInput, setPerTxInput] = useState(String(DEFAULT_CLIENT_PAY_SETTINGS.perTxLimit))
  const [monthlyInput, setMonthlyInput] = useState(String(DEFAULT_CLIENT_PAY_SETTINGS.monthlyBudget))
  const [settingsMessage, setSettingsMessage] = useState('')
  const [recordFilter, setRecordFilter] = useState<RecordFilter>('all')

  const [domain, setDomain] = useState('example.com')
  const [method, setMethod] = useState<VerifyMethod>('http')
  const [wizardStep, setWizardStep] = useState(1)
  const [isBusy, setIsBusy] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [challengeData, setChallengeData] = useState<ChallengeResponse | null>(null)
  const [attestationData, setAttestationData] = useState<AttestResponse | null>(null)
  const [registrationTxHash, setRegistrationTxHash] = useState<string | null>(null)
  const zkVerifierAddress = (import.meta.env.VITE_ZK_VERIFIER_ADDRESS || '').trim()

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  useEffect(() => {
    const nextTab = parseTab(searchParams.get('tab'))
    if (nextTab !== activeTab) {
      setActiveTab(nextTab)
    }
  }, [searchParams, activeTab])

  useEffect(() => {
    if (!walletAddress) {
      const demo = createDemoClientPayState()
      setClientPayState({
        ...demo,
        spend: { dailySpent: 0, monthlySpent: 0 },
        records: [],
      })
      setPerTxInput('')
      setMonthlyInput('')
      return
    }

    const loaded = loadClientPayState(walletAddress)
    setClientPayState(loaded)
    setPerTxInput(String(loaded.settings.perTxLimit))
    setMonthlyInput(String(loaded.settings.monthlyBudget))
  }, [walletAddress])

  useEffect(() => {
    if (walletAddress && wizardStep < 2) {
      setWizardStep(2)
    }

    if (!walletAddress && wizardStep > 1) {
      setWizardStep(1)
      setChallengeData(null)
      setAttestationData(null)
    }
  }, [walletAddress, wizardStep])

  const remainingQuota = useMemo(() => computeRemainingQuota(clientPayState), [clientPayState])

  const filteredRecords = useMemo(() => {
    if (recordFilter === 'all') return clientPayState.records
    return clientPayState.records.filter((record) => record.status === recordFilter)
  }, [clientPayState.records, recordFilter])

  const methodGuide = useMemo(() => {
    if (!challengeData) return null

    if (challengeData.method === 'http') {
      return {
        title: 'HTTP Verification Setup',
        lines: [
          `URL: https://${domain}/verify?address=${walletAddress || '<wallet>'}`,
          `Body: ${challengeData.challenge}`,
          'Then click "Verify, Attest & Register".',
        ],
      }
    }

    return {
      title: 'DNS Verification Setup',
      lines: [
        `Name: _x402-verify.${domain}`,
        'Type: TXT',
        `Value: ${challengeData.challenge}`,
        'Wait for DNS propagation, then click "Verify, Attest & Register".',
      ],
    }
  }, [challengeData, domain, walletAddress])

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab)
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const handleConnectWallet = async () => {
    const result = await connectWallet()
    if (!result.ok) {
      addLog(result.error || 'Failed to connect wallet')
    }
  }

  const chooseMethod = (next: VerifyMethod) => {
    setMethod(next)
    setWizardStep((prev) => Math.max(prev, 3))
    setChallengeData(null)
    setAttestationData(null)
    addLog(`Selected verification method: ${next.toUpperCase()}`)
  }

  const confirmDomain = () => {
    const value = domain.trim().toLowerCase()
    if (!value) {
      addLog('Domain is required.')
      return
    }

    setDomain(value)
    setWizardStep((prev) => Math.max(prev, 4))
    setChallengeData(null)
    setAttestationData(null)
    addLog(`Domain confirmed: ${value}`)
  }

  const requestChallenge = async () => {
    if (!walletAddress) {
      addLog('Connect wallet from the top-right corner first.')
      return
    }

    if (!domain.trim()) {
      addLog('Domain is required.')
      return
    }

    setIsBusy(true)
    try {
      addLog(`POST /challenge (${method.toUpperCase()})`)
      const response = await fetchJson<ChallengeResponse>('/api/attestor/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, domain, method }),
      })

      if (!response.ok || !response.data) {
        addLog(`Challenge request failed: HTTP ${response.status}`)
        addLog(shortJson(response.data ?? (response.rawText || 'no response body')))
        return
      }

      setChallengeData(response.data)
      setWizardStep((prev) => Math.max(prev, 5))
      addLog(`Challenge generated: ${response.data.challenge}`)
    } catch (error) {
      addLog(error instanceof Error ? error.message : 'Failed to request challenge')
    } finally {
      setIsBusy(false)
    }
  }

  const requestAttestation = async () => {
    if (!walletAddress || !domain || !challengeData) {
      addLog('Challenge step is not completed yet.')
      return
    }

    setIsBusy(true)
    try {
      addLog(`POST /attest (${method.toUpperCase()})`)
      const response = await fetchJson<AttestResponse>('/api/attestor/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, domain, method }),
      })

      if (!response.ok || !response.data) {
        addLog(`Attestation failed: HTTP ${response.status}`)
        addLog(shortJson(response.data ?? (response.rawText || 'no response body')))
        return
      }

      const attestation = response.data
      setAttestationData(attestation)
      setRegistrationTxHash(null)
      setWizardStep((prev) => Math.max(prev, 5))
      addLog('Attestation completed. Submitting verifyAndRegister on-chain ...')

      if (!zkVerifierAddress) {
        addLog('VITE_ZK_VERIFIER_ADDRESS is missing. Cannot submit on-chain registration.')
        return
      }

      if (!window.ethereum) {
        addLog('MetaMask provider not found.')
        return
      }

      await ensureConfluxESpaceNetwork(window.ethereum as unknown as Eip1193Provider)

      const provider = new BrowserProvider(window.ethereum as never)
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== CONFLUX_ESPACE_CHAIN_ID) {
        addLog(`Wrong network: chainId=${String(network.chainId)}. Switch MetaMask to Conflux eSpace (1030).`)
        return
      }

      const signer = await provider.getSigner()
      const signerAddress = (await signer.getAddress()).toLowerCase()
      if (signerAddress !== walletAddress.toLowerCase()) {
        addLog(`Signer mismatch. Connected: ${walletAddress}, signer: ${signerAddress}`)
        return
      }

      const contract = new Contract(zkVerifierAddress, ZK_VERIFIER_ABI, signer)
      const tx = await contract.verifyAndRegister(
        walletAddress,
        attestation.domainHash,
        BigInt(attestation.expiry),
        attestation.signature,
      )
      setRegistrationTxHash(tx.hash as string)
      addLog(`verifyAndRegister tx submitted: ${tx.hash}`)

      const receipt = await tx.wait()
      if (!receipt || Number(receipt.status) !== 1) {
        addLog('On-chain registration transaction failed.')
        if (walletAddress) {
          const failed = appendClientPayRecord(walletAddress, {
            type: 'auth',
            amount: 0,
            asset: 'USDT0',
            status: 'failed',
            createdAt: new Date().toISOString(),
            txHash: tx.hash as string,
            note: `verifyAndRegister failed for ${domain}`,
          })
          setClientPayState(failed)
        }
        return
      }

      setAuthVerified(true)
      setWizardStep((prev) => Math.max(prev, 6))
      addLog(`On-chain registration confirmed: ${tx.hash}`)

      if (walletAddress) {
        const next = appendClientPayRecord(walletAddress, {
          type: 'auth',
          amount: 0,
          asset: 'USDT0',
          status: 'success',
          createdAt: new Date().toISOString(),
          txHash: tx.hash as string,
          note: `Registered identity for ${domain} (${method.toUpperCase()})`,
        })
        setClientPayState(next)
      }
    } catch (error) {
      addLog(error instanceof Error ? error.message : 'Failed to request attestation')
    } finally {
      setIsBusy(false)
    }
  }

  const handleSaveSettings = () => {
    if (!walletAddress) {
      setSettingsMessage('Connect wallet first.')
      return
    }

    const perTx = Number(perTxInput)
    const monthly = Number(monthlyInput)

    if (!Number.isFinite(perTx) || !Number.isFinite(monthly) || perTx < 0 || monthly < 0) {
      setSettingsMessage('Please enter valid non-negative numbers.')
      return
    }

    if (monthly < perTx) {
      setSettingsMessage('Monthly budget must be greater than or equal to per-transaction limit.')
      return
    }

    const next = saveClientPaySettings(walletAddress, {
      perTxLimit: perTx,
      monthlyBudget: monthly,
    })

    const withSettingsRecord = appendClientPayRecord(walletAddress, {
      type: 'settings',
      amount: 0,
      asset: 'USDT0',
      status: 'success',
      createdAt: new Date().toISOString(),
      note: `Updated limits: perTx=${perTx}, monthly=${monthly}`,
    })

    setClientPayState({ ...withSettingsRecord, spend: next.spend })
    setSettingsMessage('Settings saved.')
  }

  const resetAuth = () => {
    setDomain('example.com')
    setMethod('http')
    setWizardStep(walletAddress ? 2 : 1)
    setChallengeData(null)
    setAttestationData(null)
    setRegistrationTxHash(null)
    setLogs([])
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Client Pay</h1>
          <p className="text-gray-400 text-lg">
            Unified client auth, budget controls, and payment records.
          </p>
        </motion.div>

        <div className="card mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <TabButton
              icon={Shield}
              label="Auth"
              active={activeTab === 'auth'}
              onClick={() => handleTabChange('auth')}
            />
            <TabButton
              icon={Settings}
              label="Budget"
              active={activeTab === 'budget'}
              onClick={() => handleTabChange('budget')}
            />
            <TabButton
              icon={List}
              label="Records"
              active={activeTab === 'records'}
              onClick={() => handleTabChange('records')}
            />
          </div>
        </div>

        {activeTab === 'auth' && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="card space-y-6">
              <h2 className="text-2xl font-bold">Client Auth Onboarding</h2>

              <WizardStep
                index={1}
                open={wizardStep >= 1}
                title="Connect MetaMask"
                description="Connect from the top-right corner to unlock actions."
                icon={Wallet}
                status={isConnected ? 'done' : 'active'}
              >
                <button
                  type="button"
                  className="btn-primary disabled:opacity-50"
                  onClick={handleConnectWallet}
                  disabled={isConnecting || isConnected}
                >
                  {isConnected ? 'Connected' : isConnecting ? 'Connecting...' : 'Connect MetaMask'}
                </button>
                {walletAddress && (
                  <p className="text-sm text-primary-300 mt-3">Connected: {walletAddress}</p>
                )}
              </WizardStep>

              {wizardStep >= 2 && (
                <WizardStep
                  index={2}
                  open
                  title="Choose Verification Method"
                  description="Use HTTP for speed or DNS for production-style proof."
                  icon={Globe}
                  status={wizardStep >= 3 ? 'done' : 'active'}
                >
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => chooseMethod('http')}
                      className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                        method === 'http'
                          ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                          : 'bg-dark-900 border-dark-600 text-gray-300'
                      }`}
                    >
                      HTTP Verification
                    </button>
                    <button
                      type="button"
                      onClick={() => chooseMethod('dns')}
                      className={`px-4 py-2 rounded-lg border text-sm font-semibold ${
                        method === 'dns'
                          ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                          : 'bg-dark-900 border-dark-600 text-gray-300'
                      }`}
                    >
                      DNS TXT Verification
                    </button>
                  </div>
                </WizardStep>
              )}

              {wizardStep >= 3 && (
                <WizardStep
                  index={3}
                  open
                  title="Set Domain"
                  description="Bind a domain to the connected wallet."
                  icon={FileText}
                  status={wizardStep >= 4 ? 'done' : 'active'}
                >
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={domain}
                      onChange={(event) => setDomain(event.target.value)}
                      placeholder="example.com"
                      className="flex-1 px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                    />
                    <button type="button" className="btn-secondary" onClick={confirmDomain}>
                      Confirm
                    </button>
                  </div>
                </WizardStep>
              )}

              {wizardStep >= 4 && (
                <WizardStep
                  index={4}
                  open
                  title="Request Challenge"
                  description="Generate a 5-minute challenge from attestor."
                  icon={KeyRound}
                  status={challengeData ? 'done' : 'active'}
                >
                  <button
                    type="button"
                    className="btn-primary disabled:opacity-50"
                    onClick={requestChallenge}
                    disabled={isBusy || !isConnected}
                  >
                    {isBusy ? 'Requesting...' : 'Create Challenge'}
                  </button>
                  {challengeData && (
                    <div className="mt-3 p-3 rounded-lg border border-dark-600 bg-dark-900">
                      <p className="text-xs text-gray-400 mb-1">Challenge</p>
                      <p className="font-mono text-primary-300 break-all">{challengeData.challenge}</p>
                    </div>
                  )}
                </WizardStep>
              )}

              {wizardStep >= 5 && challengeData && methodGuide && (
                <WizardStep
                  index={5}
                  open
                  title={methodGuide.title}
                  description="Complete domain proof, then attest and register on-chain."
                  icon={Shield}
                  status={attestationData ? 'done' : 'active'}
                >
                  <div className="p-3 rounded-lg border border-dark-600 bg-dark-900 mb-3">
                    <ul className="text-sm text-gray-200 space-y-1">
                      {methodGuide.lines.map((line) => (
                        <li key={line} className="font-mono break-all">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    className="btn-primary disabled:opacity-50"
                    onClick={requestAttestation}
                    disabled={isBusy || !isConnected}
                  >
                    {isBusy ? 'Processing...' : 'Verify, Attest & Register'}
                  </button>
                </WizardStep>
              )}

              {wizardStep >= 6 && attestationData && (
                <WizardStep
                  index={6}
                  open
                  title="Registration Complete"
                  description="Identity is submitted and registered on-chain."
                  icon={CheckCircle}
                  status="done"
                >
                  <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                    <pre className="text-xs text-green-200 font-mono whitespace-pre-wrap break-all">
                      {shortJson(attestationData)}
                    </pre>
                  </div>
                  {registrationTxHash && (
                    <p className="text-xs text-green-200 mt-3 font-mono break-all">
                      tx: {registrationTxHash}
                    </p>
                  )}
                  <p className={`text-sm mt-3 ${isAuthVerified ? 'text-amber-300' : 'text-gray-400'}`}>
                    {isAuthVerified
                      ? 'Avatar badge is gold (verified).'
                      : 'Avatar turns gold after verification.'}
                  </p>
                </WizardStep>
              )}

              <button type="button" className="btn-secondary" onClick={resetAuth}>
                Reset
              </button>
            </div>

            <div className="card">
              <h2 className="text-2xl font-bold mb-6">Onboarding Logs</h2>
              <div className="bg-dark-900 rounded-lg p-4 h-[680px] overflow-y-auto font-mono text-sm">
                <AnimatePresence>
                  {logs.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-gray-500 text-center py-8"
                    >
                      Start with Step 1 to begin.
                    </motion.div>
                  ) : (
                    logs.map((log, index) => (
                      <motion.div
                        key={`${log}-${index}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.03 }}
                        className={`mb-2 ${
                          log.includes('completed') || log.includes('connected')
                            ? 'text-green-400'
                            : log.includes('failed') || log.includes('not found')
                              ? 'text-red-400'
                              : 'text-gray-300'
                        }`}
                      >
                        {log}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="max-w-4xl mx-auto">
            <div className="card">
              <h2 className="text-2xl font-bold mb-6 text-center">Budget & Spending</h2>

              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                <MetricCard
                  label="Daily Spend"
                  value={`${formatAmount(isConnected ? clientPayState.spend.dailySpent : 0)} USDT0`}
                />
                <MetricCard
                  label="Monthly Spend"
                  value={`${formatAmount(isConnected ? clientPayState.spend.monthlySpent : 0)} USDT0`}
                />
                <MetricCard
                  label="Remaining Quota"
                  value={`${formatAmount(isConnected ? remainingQuota : 0)} USDT0`}
                />
              </div>

              <h3 className="text-lg font-semibold mb-4 text-center">Budget Settings</h3>
              <div className="space-y-4 max-w-xl mx-auto">
                <label className="block">
                  <span className="text-sm text-gray-300">Per-Transaction Limit</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={perTxInput}
                    onChange={(event) => setPerTxInput(event.target.value)}
                    className="mt-2 w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white disabled:opacity-50"
                    disabled={!isConnected}
                    placeholder={isConnected ? '50' : ''}
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-gray-300">Monthly Budget</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={monthlyInput}
                    onChange={(event) => setMonthlyInput(event.target.value)}
                    className="mt-2 w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white disabled:opacity-50"
                    disabled={!isConnected}
                    placeholder={isConnected ? '500' : ''}
                  />
                </label>

                <button
                  type="button"
                  className="btn-primary disabled:opacity-50 w-full"
                  onClick={handleSaveSettings}
                  disabled={!isConnected}
                >
                  {isConnected ? 'Save Settings' : 'Connect Wallet First'}
                </button>

                {settingsMessage && (
                  <p
                    className={`text-sm text-center ${
                      settingsMessage.includes('saved') ? 'text-green-400' : 'text-red-400'
                    }`}
                  >
                    {settingsMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="card">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold">Transaction Records</h2>
              <div className="flex gap-2">
                {(['all', 'success', 'failed'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setRecordFilter(filter)}
                    className={`px-3 py-2 rounded-lg border text-sm ${
                      recordFilter === filter
                        ? 'bg-primary-500/20 border-primary-500 text-primary-300'
                        : 'bg-dark-900 border-dark-600 text-gray-300'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'success' ? 'Success' : 'Failed'}
                  </button>
                ))}
              </div>
            </div>

            {!isConnected && (
              <div className="mb-4 p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm">
                Connect wallet to view wallet-specific local records.
              </div>
            )}

            {filteredRecords.length === 0 ? (
              <div className="text-gray-500 text-sm">No transaction records yet.</div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <RecordRow key={record.id} record={record} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TabButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: ComponentType<{ size?: string | number; className?: string }>
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 rounded-lg border text-sm font-semibold transition-colors flex items-center gap-2 ${
        active
          ? 'bg-primary-500/20 border-primary-500 text-primary-300'
          : 'bg-dark-900 border-dark-600 text-gray-300 hover:border-dark-500'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-dark-600 bg-dark-900 p-4 text-center">
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <div className="text-xl font-semibold text-primary-300">{value}</div>
    </div>
  )
}

function RecordRow({ record }: { record: ClientPayRecord }) {
  const statusClass =
    record.status === 'success'
      ? 'text-green-400 border-green-500/30 bg-green-500/10'
      : record.status === 'failed'
        ? 'text-red-400 border-red-500/30 bg-red-500/10'
        : 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10'

  return (
    <div className="rounded-lg border border-dark-600 bg-dark-900 p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-2">
        <div className="font-semibold text-gray-100 uppercase tracking-wide text-sm">{record.type}</div>
        <span className={`px-2 py-1 rounded-full border text-xs ${statusClass}`}>{record.status}</span>
      </div>

      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div>
          <div className="text-xs text-gray-400">Amount</div>
          <div className="text-gray-200">{record.amount.toFixed(1)} {record.asset}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Time</div>
          <div className="text-gray-200">{new Date(record.createdAt).toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Wallet</div>
          <div className="font-mono text-gray-300 break-all">{record.wallet}</div>
        </div>
      </div>

      {record.note && <div className="text-xs text-gray-400 mt-3">{record.note}</div>}
    </div>
  )
}

interface WizardStepProps {
  index: number
  title: string
  description: string
  icon: ComponentType<{ size?: string | number; className?: string }>
  status: 'active' | 'done'
  open: boolean
  children: ReactNode
}

function WizardStep({ index, title, description, icon: Icon, status, open, children }: WizardStepProps) {
  if (!open) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-dark-600 bg-dark-900 p-4"
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
            status === 'done'
              ? 'border-green-500 bg-green-500/15 text-green-400'
              : 'border-primary-500 bg-primary-500/15 text-primary-300'
          }`}
        >
          {status === 'done' ? <CheckCircle size={18} /> : <Icon size={18} />}
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-1">Step {index}</p>
          <h3 className="font-semibold text-white">{title}</h3>
          <p className="text-sm text-gray-400">{description}</p>
        </div>
      </div>

      {children}
    </motion.div>
  )
}
