import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, CheckCircle, XCircle, Clock, Search, Database } from 'lucide-react'
import { fetchJson, shortJson } from '../lib/api'
import { requestProtectedSandbox } from '../lib/protectedSandboxRequest'
import { useWallet } from '../context/WalletContext'

interface ResourceRoute {
  path: string
  method?: string
  description?: string
}

interface DiscoveryResource {
  name: string
  description?: string
  endpoint: string
  capabilities: string[]
  accepts?: {
    amount?: string
    asset?: string
    network?: string
  }
  routes: ResourceRoute[]
}

export default function PlaygroundPage() {
  const { isConnected, walletAddress } = useWallet()
  const [isLoading, setIsLoading] = useState(false)
  const [resources, setResources] = useState<DiscoveryResource[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [responseText, setResponseText] = useState<string>('')
  const [query, setQuery] = useState('')

  const selectedResource = resources[selectedIndex] || null

  const endpointSummary = useMemo(() => {
    if (!selectedResource) return 'No resource selected'
    return `${selectedResource.name} | ${(selectedResource.capabilities || []).join(', ') || 'n/a'}`
  }, [selectedResource])

  const loadResources = async () => {
    if (!isConnected) {
      setResponseText('Connect wallet from top-right first.')
      return
    }

    setIsLoading(true)
    setResponseText('Loading resources ...')

    try {
      const capability = query.trim()
      const search = new URLSearchParams({ limit: '20', offset: '0' })
      if (capability) {
        search.set('capability', capability)
      }

      const primary = await fetchJson<{
        data?: { resources?: DiscoveryResource[] }
        resources?: DiscoveryResource[]
      }>(`/api/sandbox/demo/api/discovery/resources?${search.toString()}`)

      const liveResources =
        primary.data?.data?.resources || primary.data?.resources || []

      if (primary.ok && liveResources.length > 0) {
        setResources(liveResources)
        setSelectedIndex(0)
        setResponseText(
          shortJson({
            source: 'facilitator-discovery',
            total: liveResources.length,
            first: liveResources[0],
          }),
        )
        return
      }

      const fallback = await fetchJson<{
        name: string
        description: string
        capabilities: string[]
        routes: ResourceRoute[]
      }>('/api/sandbox/.well-known/x402-bazaar.json')

      if (fallback.ok && fallback.data) {
        const localResource: DiscoveryResource = {
          name: fallback.data.name,
          description: fallback.data.description,
          endpoint: '/api/sandbox',
          capabilities: fallback.data.capabilities,
          accepts: { amount: '1000', asset: 'USDT0', network: 'eip155:1030' },
          routes: fallback.data.routes,
        }
        setResources([localResource])
        setSelectedIndex(0)
        setResponseText(shortJson({ source: 'well-known-fallback', resource: localResource }))
        return
      }

      setResources([])
      setResponseText('No resources found from discovery or fallback metadata.')
    } catch (error) {
      setResources([])
      setResponseText(error instanceof Error ? error.message : 'Failed to load discovery resources')
    } finally {
      setIsLoading(false)
    }
  }

  const callAgent = async () => {
    if (!isConnected) {
      setResponseText('Connect wallet from top-right first.')
      return
    }

    if (!selectedResource || !selectedResource.routes[0]?.path) {
      setResponseText('No callable route found on selected resource.')
      return
    }

    setIsLoading(true)

    try {
      const route = selectedResource.routes[0]
      const base = selectedResource.endpoint.includes('localhost:4021')
        ? '/api/sandbox'
        : selectedResource.endpoint
      const url = `${base.replace(/\/$/, '')}${route.path}`
      const method = (route.method || 'GET').toUpperCase()
      const response = route.path.startsWith('/sandbox/')
        ? await requestProtectedSandbox({
            walletAddress: walletAddress || '',
            url,
            method,
          })
        : await fetchJson(url, { method })

      setResponseText(
        shortJson({
          request: { url, method: route.method || 'GET' },
          response: {
            status: response.status,
            headers: response.headers,
            body: response.data ?? response.rawText,
          },
        }),
      )
    } catch (error) {
      setResponseText(error instanceof Error ? error.message : 'Agent call failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Discovery Playground</h1>
          <p className="text-gray-400 text-lg">
            Browse bazaar resources, inspect pricing metadata, and call endpoints live.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-1"
          >
            <div className="card mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Search size={18} />
                Query
              </h2>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white"
                placeholder="e.g. weather, refund-trigger"
              />
              <button
                onClick={loadResources}
                disabled={isLoading || !isConnected}
                className="btn-primary w-full mt-4 disabled:opacity-50"
                type="button"
              >
                {!isConnected ? 'Connect Wallet to Load' : isLoading ? 'Loading...' : 'Load Resources'}
              </button>
            </div>

            <div className="card">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Database size={18} />
                Resource List
              </h2>
              <div className="space-y-2">
                {resources.length === 0 && (
                  <div className="text-gray-500 text-sm">No resources loaded.</div>
                )}
                {resources.map((resource, index) => (
                  <motion.button
                    key={`${resource.name}-${index}`}
                    onClick={() => setSelectedIndex(index)}
                    type="button"
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      index === selectedIndex
                        ? 'bg-primary-500/20 border-2 border-primary-500'
                        : 'bg-dark-700 border-2 border-dark-600 hover:border-dark-500'
                    }`}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div className="font-semibold">{resource.name}</div>
                    <div className="text-xs text-gray-400 mt-1">{resource.description || 'No description'}</div>
                    <div className="text-xs text-primary-400 mt-2">
                      {(resource.capabilities || []).join(', ') || 'no capability tags'}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 space-y-6"
          >
            <div className="card">
              <h2 className="text-xl font-bold mb-4">Selected Resource</h2>
              {selectedResource && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-dark-600 bg-dark-800/60 p-4">
                    <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Name</div>
                    <div className="text-base font-semibold text-white">{selectedResource.name}</div>
                    <div className="text-sm text-gray-400 mt-2">{selectedResource.description || 'No description'}</div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div className="rounded-lg border border-dark-600 bg-dark-800/40 p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Endpoint</div>
                      <div className="font-mono text-primary-300 break-all">{selectedResource.endpoint}</div>
                    </div>
                    <div className="rounded-lg border border-dark-600 bg-dark-800/40 p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Route</div>
                      <div className="font-mono text-white">{selectedResource.routes[0]?.path || 'n/a'}</div>
                    </div>
                    <div className="rounded-lg border border-dark-600 bg-dark-800/40 p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Price</div>
                      <div className="text-white">
                        {selectedResource.accepts?.amount || 'n/a'} {selectedResource.accepts?.asset || ''}
                      </div>
                    </div>
                    <div className="rounded-lg border border-dark-600 bg-dark-800/40 p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Capabilities</div>
                      <div className="flex flex-wrap gap-2">
                        {(selectedResource.capabilities || []).length > 0 ? (
                          selectedResource.capabilities.map((capability) => (
                            <span
                              key={capability}
                              className="inline-flex items-center rounded-full bg-primary-500/20 px-2.5 py-1 text-xs text-primary-300"
                            >
                              {capability}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500">No capability tags</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!selectedResource && <div className="text-gray-400">{endpointSummary}</div>}

              <button
                onClick={callAgent}
                disabled={isLoading || !selectedResource || !isConnected}
                className="btn-primary mt-5 flex items-center gap-2 disabled:opacity-50"
                type="button"
              >
                {isLoading ? <Clock size={18} /> : <Play size={18} />}
                {!isConnected ? 'Connect Wallet to Call' : 'Call Selected Endpoint'}
              </button>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Response Inspector</h2>
                {responseText && responseText.startsWith('{') ? (
                  <span className="badge-success flex items-center gap-1">
                    <CheckCircle size={14} /> JSON
                  </span>
                ) : (
                  <span className="badge-info flex items-center gap-1">
                    <XCircle size={14} /> Text
                  </span>
                )}
              </div>
              <div className="bg-dark-900 rounded-lg p-4 overflow-x-auto max-h-[440px] overflow-y-auto">
                <pre className="text-sm font-mono text-gray-200 whitespace-pre-wrap">{responseText || 'No response yet.'}</pre>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
