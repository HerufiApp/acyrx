import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const COLOR = {
  stderr: '\x1b[31m',
  system: '\x1b[36m',
  reset: '\x1b[0m'
}

const TERM_OPTS = {
  fontSize: 12,
  fontFamily: 'JetBrains Mono, Menlo, Consolas, monospace',
  theme: { background: '#1b1b1b', foreground: '#d4d4d4' },
  convertEol: true
}

let nextId = 1
const newTerminalId = (): string => `term-${Date.now()}-${nextId++}`

/** Read-only tab that mirrors command output streamed by the agent. */
function OutputTerminal({ visible }: { visible: boolean }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const term = new Terminal({ ...TERM_OPTS, cursorBlink: false, disableStdin: true })
    const fit = new FitAddon()
    fitRef.current = fit
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()
    term.writeln('\x1b[90mAcyrx output — agent command output appears here.\x1b[0m')

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

  useEffect(() => {
    if (visible) {
      try {
        fitRef.current?.fit()
      } catch {
        /* ignore */
      }
    }
  }, [visible])

  return <div ref={containerRef} className="h-full w-full overflow-hidden p-1" />
}

/** Interactive tab backed by a real PTY shell — fully writable, VS Code-style. */
function InteractiveTerminal({
  id,
  visible,
  onExit
}: {
  id: string
  visible: boolean
  onExit: (id: string) => void
}): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)

  // Keep the latest onExit without making it an effect dependency — otherwise a
  // parent re-render would tear down and respawn the shell (and the resulting
  // exit event would close the tab).
  const onExitRef = useRef(onExit)
  onExitRef.current = onExit

  useEffect(() => {
    if (!containerRef.current) return
    const term = new Terminal({ ...TERM_OPTS, cursorBlink: true })
    const fit = new FitAddon()
    termRef.current = term
    fitRef.current = fit
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    void window.codex.terminalCreate({ id, cols: term.cols, rows: term.rows })

    const inputDisposable = term.onData((data) => window.codex.terminalInput({ id, data }))

    const offData = window.codex.onPtyData((d) => {
      if (d.id === id) term.write(d.data)
    })
    const offExit = window.codex.onPtyExit((e) => {
      if (e.id === id) onExitRef.current(id)
    })

    const ro = new ResizeObserver(() => {
      try {
        fit.fit()
        window.codex.terminalResize({ id, cols: term.cols, rows: term.rows })
      } catch {
        /* ignore */
      }
    })
    ro.observe(containerRef.current)

    return () => {
      inputDisposable.dispose()
      offData()
      offExit()
      ro.disconnect()
      window.codex.terminalKill(id)
      term.dispose()
    }
  }, [id])

  // Refit + focus whenever this tab becomes the active one (hidden tabs measure as 0px).
  useEffect(() => {
    if (!visible) return
    const term = termRef.current
    const fit = fitRef.current
    if (!term || !fit) return
    try {
      fit.fit()
      window.codex.terminalResize({ id, cols: term.cols, rows: term.rows })
      term.focus()
    } catch {
      /* ignore */
    }
  }, [visible, id])

  return <div ref={containerRef} className="h-full w-full overflow-hidden p-1" />
}

const OUTPUT_TAB = 'output'

export default function TerminalPanel(): JSX.Element {
  const [shellIds, setShellIds] = useState<string[]>(() => [newTerminalId()])
  const [activeTab, setActiveTab] = useState<string>(() => shellIds[0] ?? OUTPUT_TAB)

  // Mirror shellIds in a ref so the stable closeShell can pick a neighbour tab.
  const shellIdsRef = useRef(shellIds)
  shellIdsRef.current = shellIds

  const addShell = useCallback((): void => {
    const id = newTerminalId()
    setShellIds((ids) => [...ids, id])
    setActiveTab(id)
  }, [])

  const closeShell = useCallback((id: string): void => {
    const remaining = shellIdsRef.current.filter((x) => x !== id)
    setShellIds(remaining)
    setActiveTab((current) =>
      current === id ? (remaining[remaining.length - 1] ?? OUTPUT_TAB) : current
    )
  }, [])

  return (
    <div className="flex h-full flex-col bg-bg-panel">
      <div className="flex h-7 shrink-0 items-center border-b border-border bg-bg-panel">
        <button
          onClick={() => setActiveTab(OUTPUT_TAB)}
          className={`flex h-full items-center border-r border-border px-3 text-[11px] font-semibold uppercase tracking-wide ${
            activeTab === OUTPUT_TAB ? 'bg-bg text-white' : 'opacity-60 hover:opacity-100'
          }`}
        >
          Output
        </button>
        {shellIds.map((id, i) => (
          <div
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex h-full cursor-pointer items-center gap-2 border-r border-border px-3 text-[12px] ${
              activeTab === id ? 'bg-bg text-white' : 'opacity-70 hover:opacity-100'
            }`}
            title="Interactive shell"
          >
            <span>bash {i + 1}</span>
            <span
              className="opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation()
                closeShell(id)
              }}
            >
              ✕
            </span>
          </div>
        ))}
        <button
          onClick={addShell}
          className="flex h-full items-center px-3 text-[14px] opacity-60 hover:opacity-100"
          title="New terminal"
        >
          +
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          className="absolute inset-0"
          style={{ visibility: activeTab === OUTPUT_TAB ? 'visible' : 'hidden' }}
        >
          <OutputTerminal visible={activeTab === OUTPUT_TAB} />
        </div>
        {shellIds.map((id) => (
          <div
            key={id}
            className="absolute inset-0"
            style={{ visibility: activeTab === id ? 'visible' : 'hidden' }}
          >
            <InteractiveTerminal id={id} visible={activeTab === id} onExit={closeShell} />
          </div>
        ))}
      </div>
    </div>
  )
}
