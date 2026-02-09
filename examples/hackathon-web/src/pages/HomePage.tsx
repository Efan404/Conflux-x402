import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Shield, Zap, WalletCards, SearchCode, Hammer } from 'lucide-react'

export default function HomePage() {
  const features = [
    {
      icon: Hammer,
      title: 'Developer Scaffold',
      description: 'Bootstrap x402 on Conflux quickly with create-x402-conflux-app and runbook.',
    },
    {
      icon: Zap,
      title: 'x402 Paywall Flow',
      description: 'Visualize request, 402 challenge, payment settlement context, and unlocked response.',
    },
    {
      icon: Shield,
      title: 'Auth Gate',
      description: 'Enforce 403 before 402 when signature/identity checks are enabled.',
    },
    {
      icon: WalletCards,
      title: 'Refund Tracking',
      description: 'Trigger a simulated business failure and track async refund status by requestId.',
    },
    {
      icon: SearchCode,
      title: 'Agent Discovery',
      description: 'Discover paid resources by capability and inspect route + pricing metadata.',
    },
  ]

  const judgeFlow = [
    {
      step: '01',
      title: 'Run Paywall Demo',
      desc: 'Show 402 handshake and response timeline for protected endpoints.',
    },
    {
      step: '02',
      title: 'Open Discovery Service',
      desc: 'Fetch bazaar resources and call chart agent in one click.',
    },
    {
      step: '03',
      title: 'Verify Refund Tracker',
      desc: 'Trigger refund flow, capture requestId, and poll final state.',
    },
  ]

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-blue-500/10" />

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="inline-block mb-6"
            >
              <span className="px-4 py-2 bg-primary-500/20 text-primary-400 rounded-full text-sm font-medium border border-primary-500/30">
                Conflux eSpace x402 Toolkit
              </span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-primary-200 to-primary-400 bg-clip-text text-transparent">
              Monetize APIs with On-Chain Payments
            </h1>

            <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-4xl mx-auto">
              A best toolkit for x402 on Conflux: paywall flows, discovery bazaar,
              async refund observability, and developer onboarding in one UI.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/demo">
                <motion.button
                  className="btn-primary flex items-center space-x-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span>Start Live Demo</span>
                  <ArrowRight size={20} />
                </motion.button>
              </Link>

              <Link to="/quickstart">
                <motion.button
                  className="btn-secondary"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Developer Quickstart
                </motion.button>
              </Link>
            </div>
          </motion.div>

          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl animate-pulse-slow" />
          <div
            className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow"
            style={{ animationDelay: '1s' }}
          />
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Core Capabilities</h2>
            <p className="text-gray-400 text-lg">Mapped directly to live endpoints and workflow commands</p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                whileHover={{ y: -5 }}
                className="card group"
              >
                <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary-500/30 transition-colors">
                  <feature.icon className="text-primary-400" size={24} />
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-dark-800/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">3-Minute Judge Walkthrough</h2>
            <p className="text-gray-400 text-lg">The fastest path to demonstrate technical depth and product clarity</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {judgeFlow.map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.2, duration: 0.5 }}
                className="relative"
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-2xl font-bold">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                    <p className="text-gray-400">{item.desc}</p>
                  </div>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-8 -right-4 w-8 h-0.5 bg-gradient-to-r from-primary-500 to-transparent" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-500/20 to-blue-500/20 border border-primary-500/30 p-12 text-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-blue-500/10 animate-pulse-slow" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready for Live Evaluation?</h2>
              <p className="text-gray-300 text-lg mb-8">
                Use the integrated demos to prove paywall reliability, discovery usability, refund transparency,
                and developer onboarding quality.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/demo">
                  <motion.button
                    className="btn-primary text-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Open Demo Console
                  </motion.button>
                </Link>
                <Link to="/quickstart">
                  <motion.button
                    className="btn-secondary text-lg"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    Open Developer Quickstart
                  </motion.button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
