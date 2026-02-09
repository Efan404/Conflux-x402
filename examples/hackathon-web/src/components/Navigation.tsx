import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Menu, X, ChevronDown, LogOut, Wallet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useWallet } from '../context/WalletContext'

export default function Navigation() {
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)
  const { walletAddress, isConnected, isConnecting, isAuthVerified, connectWallet, disconnectWallet } =
    useWallet()

  const navItems = [
    { path: '/', label: 'Overview' },
    { path: '/quickstart', label: 'Developer Quickstart' },
    { path: '/demo', label: 'Paywall Demo' },
    { path: '/playground', label: 'Discovery Service' },
    { path: '/ai-pay', label: 'Client Pay' },
  ]

  const shortAddress = useMemo(() => {
    if (!walletAddress) return ''
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
  }, [walletAddress])

  const avatarClass = isAuthVerified
    ? 'bg-amber-400/20 border-amber-400 text-amber-300'
    : 'bg-primary-500/20 border-primary-500 text-primary-300'

  const avatarText = walletAddress ? walletAddress.slice(2, 4).toUpperCase() : 'W'

  useEffect(() => {
    setProfileOpen(false)
    setIsOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!profileRef.current) return
      if (!profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-dark-900/95 backdrop-blur-sm border-b border-dark-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <motion.div
              className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center"
              whileHover={{ scale: 1.05, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-white font-bold text-xl">C</span>
            </motion.div>
            <span className="text-xl font-bold text-white">Conflux x402 Toolkit</span>
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="relative px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                {item.label}
                {location.pathname === item.path && (
                  <motion.div
                    layoutId="navbar-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>

          <div ref={profileRef} className="hidden md:block relative">
            {!isConnected ? (
              <motion.button
                type="button"
                onClick={async () => {
                  await connectWallet()
                }}
                className="btn-secondary flex items-center gap-2"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                disabled={isConnecting}
              >
                <Wallet size={16} />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </motion.button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setProfileOpen((prev) => !prev)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full border ${avatarClass}`}
                >
                  <span className="w-8 h-8 rounded-full border border-current flex items-center justify-center text-xs font-semibold">
                    {avatarText}
                  </span>
                  <ChevronDown size={16} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-dark-600 bg-dark-800 shadow-xl p-2 z-50">
                    <div className="px-3 py-2 border-b border-dark-600">
                      <p className="text-xs text-gray-400">Connected Wallet</p>
                      <p className="text-sm text-gray-200 font-mono break-all">{shortAddress}</p>
                      <p
                        className={`text-xs mt-1 ${
                          isAuthVerified ? 'text-amber-300' : 'text-gray-400'
                        }`}
                      >
                        {isAuthVerified ? 'Auth Verified' : 'Auth Not Verified'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        disconnectWallet()
                        setProfileOpen(false)
                      }}
                      className="w-full mt-1 px-3 py-2 rounded-md text-left text-sm text-gray-200 hover:bg-dark-700 flex items-center gap-2"
                    >
                      <LogOut size={14} />
                      Disconnect
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="md:hidden p-2 text-gray-300 hover:text-white"
            type="button"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="md:hidden bg-dark-800 border-t border-dark-700"
        >
          <div className="px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-500/20 text-primary-400'
                    : 'text-gray-300 hover:bg-dark-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
            {!isConnected ? (
              <button
                type="button"
                onClick={async () => {
                  await connectWallet()
                  setIsOpen(false)
                }}
                className="w-full btn-secondary text-left flex items-center justify-center gap-2"
                disabled={isConnecting}
              >
                <Wallet size={16} />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <div className={`rounded-lg border p-3 ${avatarClass}`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{shortAddress}</span>
                  <span className="text-xs">{isAuthVerified ? 'Verified' : 'Unverified'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    disconnectWallet()
                    setIsOpen(false)
                  }}
                  className="w-full mt-2 px-3 py-2 rounded-md bg-dark-700 text-sm text-gray-100 flex items-center justify-center gap-2"
                >
                  <LogOut size={14} />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </nav>
  )
}
