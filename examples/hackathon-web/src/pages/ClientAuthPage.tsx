import { useEffect, useMemo, useState } from 'react'
import type { ComponentType } from 'react'
import type { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Shield, Wallet, Globe, FileText, KeyRound } from 'lucide-react'
import { fetchJson, shortJson } from '../lib/api'
import { useWallet } from '../context/WalletContext'

type VerifyMethod = 'http' | 'dns'

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

export default function ClientAuthPage() {
  const {
    walletAddress,
    isConnected,
    isConnecting,
    isAuthVerified,
    connectWallet,
    setAuthVerified,
  } = useWallet()

  const [domain, setDomain] = useState('example.com')
  const [method, setMethod] = useState<VerifyMethod>('http')
  const [wizardStep, setWizardStep] = useState(1)
  const [isBusy, setIsBusy] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [challengeData, setChallengeData] = useState<ChallengeResponse | null>(null)
  const [attestationData, setAttestationData] = useState<AttestResponse | null>(null)

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  useEffect(() => {
    if (walletAddress && wizardStep < 2) {
      setWizardStep(2)
      addLog(`Wallet connected: ${walletAddress}`)
    }

    if (!walletAddress && wizardStep > 1) {
      setWizardStep(1)
      setChallengeData(null)
      setAttestationData(null)
      addLog('Wallet disconnected. Reconnect to continue.')
    }
  }, [walletAddress, wizardStep])

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

      setAttestationData(response.data)
      setAuthVerified(true)
      setWizardStep((prev) => Math.max(prev, 6))
      addLog('Attestation completed. Profile is now marked as verified.')
    } catch (error) {
      addLog(error instanceof Error ? error.message : 'Failed to request attestation')
    } finally {
      setIsBusy(false)
    }
  }

  const methodGuide = useMemo(() => {
    if (!challengeData) return null

    if (challengeData.method === 'http') {
      return {
        title: 'HTTP Verification Setup',
        lines: [
          `URL: https://${domain}/verify?address=${walletAddress || '<wallet>'}`,
          `Body: ${challengeData.challenge}`,
          'Then click "Verify & Attest".',
        ],
      }
    }

    return {
      title: 'DNS Verification Setup',
      lines: [
        `Name: _x402-verify.${domain}`,
        'Type: TXT',
        `Value: ${challengeData.challenge}`,
        'Wait for DNS propagation, then click "Verify & Attest".',
      ],
    }
  }, [challengeData, domain, walletAddress])

  const reset = () => {
    setDomain('example.com')
    setMethod('http')
    setWizardStep(walletAddress ? 2 : 1)
    setChallengeData(null)
    setAttestationData(null)
    setLogs([])
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Client Auth</h1>
          <p className="text-gray-400 text-lg">Guided wallet-domain attestation flow.</p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="card space-y-6">
            <h2 className="text-2xl font-bold">Client Onboarding</h2>

            <WizardStep
              index={1}
              open={wizardStep >= 1}
              title="Connect MetaMask"
              description="Connect from the top-right corner to unlock all actions."
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
                description="Use HTTP for fast setup or DNS for production-grade proof."
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
                title="Set Target Domain"
                description="Enter the domain to bind with this wallet."
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
                description="Generate a time-limited challenge from attestor."
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
                description="Complete domain proof, then submit attestation."
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
                  {isBusy ? 'Verifying...' : 'Verify & Attest'}
                </button>
              </WizardStep>
            )}

            {wizardStep >= 6 && attestationData && (
              <WizardStep
                index={6}
                open
                title="Attestation Ready"
                description="Signed attestation is ready for identity registration."
                icon={CheckCircle}
                status="done"
              >
                <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                  <pre className="text-xs text-green-200 font-mono whitespace-pre-wrap break-all">
                    {shortJson(attestationData)}
                  </pre>
                </div>
                <p className={`text-sm mt-3 ${isAuthVerified ? 'text-amber-300' : 'text-gray-400'}`}>
                  {isAuthVerified
                    ? 'Profile badge is now gold (verified).'
                    : 'Profile badge will turn gold after verification.'}
                </p>
              </WizardStep>
            )}

            <button type="button" className="btn-secondary" onClick={reset}>
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
      </div>
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
