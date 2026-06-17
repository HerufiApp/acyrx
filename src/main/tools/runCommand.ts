import { spawn } from 'child_process'
import { getProjectRoot, emitTerminal, emitAgent } from '../projectState'
import { createApproval } from '../agent/approvals'
import type { ToolCallArgs } from '@shared/types'
import type { ToolContext } from './index'

/** Patterns that mark a command as potentially destructive -> require confirm. */
const DESTRUCTIVE: RegExp[] = [
  /\brm\b[^\n]*\s-[a-z]*[rf]/i,
  /\bsudo\b/i,
  /\bdd\b\s+if=/i,
  /\bmkfs\b/i,
  /:\(\)\s*\{/, // fork bomb
  /\bgit\s+push\b/i,
  /\bgit\s+reset\s+--hard\b/i,
  /\bgit\s+clean\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bkillall\b/i,
  /\bchmod\s+-R\b/i,
  /\bchown\s+-R\b/i,
  /\btruncate\b/i,
  />\s*\/dev\/(sd|nvme|disk)/i,
  /\bnpm\s+publish\b/i
]

const MAX_OUTPUT = 100_000

function isDestructive(cmd: string): boolean {
  return DESTRUCTIVE.some((re) => re.test(cmd))
}

export async function runCommand(
  args: ToolCallArgs['run_command'],
  ctx: ToolContext
): Promise<string> {
  const root = getProjectRoot()
  if (!root) throw new Error('No project folder is open.')

  const cmd = args.command
  if (isDestructive(cmd)) {
    const { id, promise } = createApproval()
    emitAgent({
      type: 'command-confirm',
      id,
      command: cmd,
      reason: 'This command looks potentially destructive.'
    })
    const accepted = await promise
    emitAgent({ type: 'command-resolved', id, accepted })
    if (!accepted) {
      return 'The user declined to run this command. It was NOT executed.'
    }
  }

  return execStreaming(cmd, root, ctx)
}

function execStreaming(cmd: string, cwd: string, ctx: ToolContext): Promise<string> {
  return new Promise((resolve) => {
    emitTerminal({ data: `$ ${cmd}\r\n`, stream: 'system' })

    const child = spawn(cmd, { cwd, shell: true, env: process.env })
    let captured = ''

    const onData = (buf: Buffer, stream: 'stdout' | 'stderr'): void => {
      const text = buf.toString()
      if (captured.length < MAX_OUTPUT) captured += text
      emitTerminal({ data: text.replace(/\r?\n/g, '\r\n'), stream })
    }

    child.stdout.on('data', (b: Buffer) => onData(b, 'stdout'))
    child.stderr.on('data', (b: Buffer) => onData(b, 'stderr'))

    const onAbort = (): void => {
      child.kill('SIGKILL')
    }
    ctx.signal.addEventListener('abort', onAbort, { once: true })

    child.on('error', (err) => {
      ctx.signal.removeEventListener('abort', onAbort)
      emitTerminal({ data: `\r\n[failed to start: ${err.message}]\r\n`, stream: 'system' })
      resolve(`Failed to start command: ${err.message}`)
    })

    child.on('close', (code, sig) => {
      ctx.signal.removeEventListener('abort', onAbort)
      emitTerminal({ data: `\r\n[exit ${code ?? sig}]\r\n`, stream: 'system' })
      const trimmed =
        captured.length > MAX_OUTPUT
          ? captured.slice(0, MAX_OUTPUT) + '\n[...output truncated]'
          : captured
      resolve(
        `Command "${cmd}" exited with code ${code ?? sig}.\n\nOutput:\n${trimmed || '(no output)'}`
      )
    })
  })
}
