import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const COLOR = {
  stderr: '\x1b[31m',
  system: '\x1b[36m',
  reset: '\x1b[0m'
}

export default function TerminalPanel(): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      fontSize: 12,
      fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
      theme: { background: '#1b1b1b', foreground: '#d4d4d4' },
      convertEol: true,
      cursorBlink: false,
      disableStdin: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    term.writeln('\x1b[90mAcyrx terminal — command output appears here.\x1b[0m')

    const off = window.codex.onTerminalData((d) => {
      if (d.stream === 'stderr') term.write(COLOR.stderr + d.data + COLOR.reset)
      else if (d.stream === 'system') term.write(COLOR.system + d.data + COLOR.reset)
      else term.write(d.data)
    })

    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
      } catch {
        /* ignore */
      }
    })
    ro.observe(containerRef.current)

    return () => {
      off()
      ro.disconnect()
      term.dispose()
    }
  }, [])

  return (
    <div className="flex h-full flex-col bg-bg-panel">
      <div className="flex h-7 shrink-0 items-center border-b border-border px-3 text-[11px] font-semibold uppercase tracking-wide opacity-60">
        Terminal
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-1" />
    </div>
  )
}
