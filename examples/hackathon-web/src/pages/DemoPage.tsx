import { useState } from 'react'
import type { ComponentType } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, Clock, Shield, CreditCard, Zap, AlertCircle } from 'lucide-react'
import { fetchJson, shortJson } from '../lib/api'
import { requestProtectedSandbox } from '../lib/protectedSandboxRequest'
import { useWallet } from '../context/WalletContext'

type FlowStep = 'idle' | 'connecting' | 'verifying' | 'payment' | 'success' | 'error'
type DemoScenario = 'paywall' | 'auth' | 'refund'

export default function DemoPage() {
  const { isConnected, walletAddress } = useWallet()
  const [selectedScenario, setSelectedScenario] = useState<DemoScenario>('paywall')
  const [currentStep, setCurrentStep] = useState<FlowStep>('idle')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const runPaywallFlow = async () => {
    setCurrentStep('connecting')
    setLogs([])
    addLog('Sending request to GET /sandbox/weather ...')

    if (!walletAddress) {
      setCurrentStep('error')
      addLog('Missing wallet address. Reconnect wallet and retry.')
      return
    }

    const response = await requestProtectedSandbox({
      walletAddress,
      url: '/api/sandbox/sandbox/weather',
      method: 'GET',
    })
    addLog(`HTTP ${response.status} received (requestId: ${response.requestId})`)

    setCurrentStep('payment')

    if (response.status === 402) {
      addLog('Payment challenge still returned (402). Complete wallet payment and retry.')
      setCurrentStep('error')
      return
    }

    if (response.ok) {
      addLog(`Settlement complete. payment-response: ${response.headers['payment-response'] || 'n/a'}`)
      setCurrentStep('success')
      addLog(`Payload: ${shortJson(response.data ?? response.rawText)}`)
      return
    }

    if (response.status === 403) {
      addLog('Auth rejected request. Confirm identity is registered on-chain for this wallet.')
    }

    setCurrentStep('error')
    addLog(`Unexpected response: ${response.status}`)
    addLog(response.rawText || 'No response body')
  }

  const runAuthFlow = async () => {
    setCurrentStep('connecting')
    setLogs([])
    addLog('Calling protected endpoint without auth signature headers ...')

    const response = await fetchJson('/api/sandbox/sandbox/weather')
    setCurrentStep('verifying')

    if (response.status === 403) {
      addLog('Auth gate correctly rejected request with 403')
      addLog(`Reason: ${shortJson(response.data ?? response.rawText)}`)
      setCurrentStep('success')
      return
    }

    if (response.status === 402 || response.status === 200) {
      addLog('AUTH_MODE seems disabled in current environment (expected 403 before 402 when enabled)')
      addLog(`Current status: ${response.status}`)
      setCurrentStep('error')
      return
    }

    addLog(`Unexpected status: ${response.status}`)
    setCurrentStep('error')
  }

  const runRefundFlow = async () => {
    setCurrentStep('connecting')
    setLogs([])
    addLog('Triggering demo refund via GET /sandbox/refund-trigger ...')

    if (!walletAddress) {
      setCurrentStep('error')
      addLog('Missing wallet address. Reconnect wallet and retry.')
      return
    }

    const trigger = await requestProtectedSandbox({
      walletAddress,
      url: '/api/sandbox/sandbox/refund-trigger',
      method: 'GET',
    })
    addLog(`Trigger response: HTTP ${trigger.status} (requestId: ${trigger.requestId})`)

    if (trigger.status === 402) {
      setCurrentStep('error')
      addLog('Payment challenge not settled. Refund record is created only after settlement.')
      addLog(trigger.rawText || 'No response body')
      return
    }

    if (trigger.status === 403) {
      setCurrentStep('error')
      addLog('Auth rejected refund trigger.')
      const message = (trigger.data as { message?: string; payer?: string } | null)?.message
      const payer = (trigger.data as { message?: string; payer?: string } | null)?.payer
      if (message === 'Identity not registered or expired') {
        addLog(`Identity missing/expired for payer: ${payer || walletAddress || 'unknown'}`)
        addLog('Complete Client Pay > Auth (Verify, Attest & Register) with this same wallet address.')
      } else {
        addLog('Confirm identity is registered on-chain for this wallet.')
      }
      addLog(trigger.rawText || 'No response body')
      return
    }

    if (!trigger.ok) {
      setCurrentStep('error')
      addLog(`Refund trigger failed: HTTP ${trigger.status}`)
      addLog(trigger.rawText || 'No response body')
      return
    }

    const requestId = trigger.requestId || trigger.headers['x-request-id']
    if (!requestId) {
      setCurrentStep('error')
      addLog('Missing x-request-id header; cannot poll refund state')
      return
    }

    setCurrentStep('verifying')
    addLog(`requestId captured: ${requestId}`)

    for (let i = 0; i < 10; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      const poll = await fetchJson(`/api/sandbox/refunds/${encodeURIComponent(requestId)}`)
      if (poll.status === 404) {
        addLog('Refund record not available yet; retrying ...')
        continue
      }

      setCurrentStep('payment')
      const state = (poll.data as { state?: string } | null)?.state || 'unknown'
      addLog(`Refund state: ${state}`)

      if (state === 'refund_submitted' || state === 'settled') {
        setCurrentStep('success')
        addLog(
          state === 'refund_submitted'
            ? 'Refund transaction submitted successfully'
            : 'Refund completed successfully',
        )
        addLog(shortJson(poll.data))
        return
      }

      if (state === 'refund_failed') {
        setCurrentStep('error')
        addLog('Refund failed in worker pipeline')
        addLog(shortJson(poll.data))
        return
      }
    }

    setCurrentStep('error')
    addLog('Polling timeout reached before terminal refund state')
  }

  const startDemo = async () => {
    if (!isConnected) {
      setLogs([`[${new Date().toLocaleTimeString()}] Connect wallet from top-right first.`])
      return
    }

    try {
      if (selectedScenario === 'paywall') {
        await runPaywallFlow()
      } else if (selectedScenario === 'auth') {
        await runAuthFlow()
      } else {
        await runRefundFlow()
      }
    } catch (error) {
      setCurrentStep('error')
      addLog(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  const resetDemo = () => {
    setCurrentStep('idle')
    setLogs([])
  }

  const scenarios = [
    {
      id: 'paywall' as const,
      title: 'Paywall Handshake',
      description: 'Request protected endpoint and inspect 402 payment challenge',
      icon: CreditCard,
      color: 'from-green-500 to-emerald-500',
    },
    {
      id: 'auth' as const,
      title: 'Auth Gate Check',
      description: 'Validate 403-before-402 behavior when AUTH_MODE=domain_gate',
      icon: Shield,
      color: 'from-red-500 to-pink-500',
    },
    {
      id: 'refund' as const,
      title: 'Refund Tracker',
      description: 'Trigger failure and poll async refund lifecycle by requestId',
      icon: Zap,
      color: 'from-blue-500 to-cyan-500',
    },
  ]

  const getStepStatus = (step: string) => {
    const steps = ['connecting', 'verifying', 'payment', 'success']
    const currentIndex = steps.indexOf(currentStep)
    const stepIndex = steps.indexOf(step)

    if (currentStep === 'error' && (step === 'verifying' || step === 'payment')) return 'error'
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'active'
    return 'pending'
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Paywall Demo</h1>
          <p className="text-gray-400 text-lg">Run paywall, auth, and refund scenarios with live telemetry.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {scenarios.map((scenario, index) => (
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => {
                setSelectedScenario(scenario.id)
                resetDemo()
              }}
              className={`card cursor-pointer transition-all ${
                selectedScenario === scenario.id
                  ? 'border-primary-500 shadow-lg shadow-primary-500/20'
                  : 'hover:border-gray-600'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-lg bg-gradient-to-br ${scenario.color} flex items-center justify-center mb-4`}
              >
                <scenario.icon className="text-white" size={24} />
              </div>
              <h3 className="text-xl font-semibold mb-2">{scenario.title}</h3>
              <p className="text-gray-400 text-sm">{scenario.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
          >
            <h2 className="text-2xl font-bold mb-6">Flow State</h2>

            <div className="space-y-4">
              <FlowStepComponent icon={Zap} title="Send Request" status={getStepStatus('connecting')} />
              <FlowStepComponent icon={Shield} title="Gate/Policy Check" status={getStepStatus('verifying')} />
              <FlowStepComponent icon={CreditCard} title="Payment or Refund Stage" status={getStepStatus('payment')} />
              <FlowStepComponent
                icon={currentStep === 'error' ? AlertCircle : CheckCircle}
                title={currentStep === 'error' ? 'Flow Failed' : 'Flow Completed'}
                status={
                  currentStep === 'success'
                    ? 'completed'
                    : currentStep === 'error'
                      ? 'error'
                      : 'pending'
                }
              />
            </div>

            <div className="mt-8 flex gap-4">
              <motion.button
                onClick={startDemo}
                disabled={
                  !isConnected ||
                  (currentStep !== 'idle' && currentStep !== 'success' && currentStep !== 'error')
                }
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                whileHover={{
                  scale:
                    currentStep === 'idle' || currentStep === 'success' || currentStep === 'error'
                      ? 1.02
                      : 1,
                }}
                whileTap={{
                  scale:
                    currentStep === 'idle' || currentStep === 'success' || currentStep === 'error'
                      ? 0.98
                      : 1,
                }}
              >
                {!isConnected
                  ? 'Connect Wallet to Run'
                  : currentStep === 'idle'
                  ? 'Run Scenario'
                  : currentStep === 'success' || currentStep === 'error'
                    ? 'Run Again'
                    : 'Running...'}
              </motion.button>

              {(currentStep === 'success' || currentStep === 'error') && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={resetDemo}
                  className="btn-secondary"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Reset
                </motion.button>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="card"
          >
            <h2 className="text-2xl font-bold mb-6">Live Logs</h2>

            <div className="bg-dark-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
              <AnimatePresence>
                {logs.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-gray-500 text-center py-8"
                  >
                    Waiting to start...
                  </motion.div>
                ) : (
                  logs.map((log, index) => (
                    <motion.div
                      key={`${log}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 }}
                      className={`mb-2 ${
                        log.includes('completed') || log.includes('success') || log.includes('402')
                          ? 'text-green-400'
                          : log.includes('failed') || log.includes('error') || log.includes('Unexpected')
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
          </motion.div>
        </div>
      </div>
    </div>
  )
}

interface FlowStepProps {
  icon: ComponentType<{ size?: string | number }>
  title: string
  status: 'pending' | 'active' | 'completed' | 'error'
}

function FlowStepComponent({ icon: Icon, title, status }: FlowStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center space-x-4 relative"
    >
      <div
        className={`
        w-12 h-12 rounded-full flex items-center justify-center transition-all
        ${
          status === 'completed'
            ? 'bg-green-500/20 text-green-400 border-2 border-green-500'
            : status === 'active'
              ? 'bg-primary-500/20 text-primary-400 border-2 border-primary-500 animate-pulse'
              : status === 'error'
                ? 'bg-red-500/20 text-red-400 border-2 border-red-500'
                : 'bg-dark-700 text-gray-500 border-2 border-dark-600'
        }
      `}
      >
        {status === 'completed' ? (
          <CheckCircle size={24} />
        ) : status === 'error' ? (
          <XCircle size={24} />
        ) : status === 'active' ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Clock size={24} />
          </motion.div>
        ) : (
          <Icon size={24} />
        )}
      </div>

      <div className="flex-1">
        <div
          className={`font-medium ${
            status === 'completed'
              ? 'text-green-400'
              : status === 'active'
                ? 'text-primary-400'
                : status === 'error'
                  ? 'text-red-400'
                  : 'text-gray-500'
          }`}
        >
          {title}
        </div>
      </div>
    </motion.div>
  )
}
