import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CommandBlockProps {
  title: string
  command: string
  copyLabel?: string
}

export default function CommandBlock({ title, command, copyLabel = 'Copy' }: CommandBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
        <h4 className="text-sm font-semibold text-gray-200">{title}</h4>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 rounded-md bg-dark-700 hover:bg-dark-600 text-gray-200 border border-dark-600 flex items-center gap-1"
        >
          {copied ? <Check size={14} className="text-primary-400" /> : <Copy size={14} />}
          {copied ? 'Copied' : copyLabel}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono text-primary-200 whitespace-pre-wrap overflow-x-auto">{command}</pre>
    </div>
  )
}
