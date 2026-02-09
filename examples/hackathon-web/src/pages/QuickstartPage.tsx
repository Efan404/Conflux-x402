import { motion } from 'framer-motion'
import { Sparkles, TerminalSquare, Rocket } from 'lucide-react'
import CommandBlock from '../components/CommandBlock'

export default function QuickstartPage() {
  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="text-primary-400" size={22} />
            <h1 className="text-4xl font-bold">Developer Quickstart</h1>
          </div>
          <p className="text-gray-300 text-lg mb-6">
            Create a runnable Conflux x402 project with the minimal setup path.
          </p>
          <CommandBlock
            title="Create Project"
            command="npx create-x402-conflux-app"
            copyLabel="Copy Command"
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-4">
            <TerminalSquare size={20} className="text-primary-400" />
            <h2 className="text-2xl font-bold">Core Setup</h2>
          </div>

          <div className="space-y-3">
            <CommandBlock title="1) Enter project" command="cd <your-project>" />
            <CommandBlock title="2) Install" command="pnpm install" />
            <CommandBlock title="3) Copy env" command="cp .env.example .env" />
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card"
        >
          <h2 className="text-2xl font-bold mb-4">Required Environment Values</h2>
          <CommandBlock
            title=".env Minimum"
            command={`FACILITATOR_PRIVATE_KEY=0x...
CLIENT_PRIVATE_KEY=0x...
EVM_ADDRESS=0x...`}
            copyLabel="Copy"
          />
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-4">
            <Rocket size={20} className="text-primary-400" />
            <h2 className="text-2xl font-bold">Run</h2>
          </div>
          <div className="space-y-3">
            <CommandBlock title="Start facilitator" command="pnpm dev:facilitator" />
            <CommandBlock title="Start sandbox" command="pnpm dev:sandbox" />
            <CommandBlock title="Run client" command="pnpm start:client" />
          </div>
          <p className="text-sm text-gray-400 mt-4">
            Note: <code className="font-mono">dev:server</code> remains an alias of{' '}
            <code className="font-mono">dev:sandbox</code>.
          </p>
        </motion.section>
      </div>
    </div>
  )
}
