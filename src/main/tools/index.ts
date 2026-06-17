import type { ToolName } from '@shared/types'
import { readFile } from './readFile'
import { writeFile } from './writeFile'
import { editFile } from './editFile'
import { listDir } from './listDir'
import { runCommand } from './runCommand'
import { search } from './search'

export interface ToolContext {
  /** Aborts in-flight work (e.g. a running command) when the turn is cancelled. */
  signal: AbortSignal
}

/**
 * Dispatch a tool call by name. Returns a model-facing result string. Throws on
 * error; the agent loop converts thrown errors into a failed functionResponse.
 */
export async function runTool(
  name: ToolName,
  args: Record<string, unknown>,
  ctx: ToolContext
): Promise<string> {
  switch (name) {
    case 'read_file':
      return readFile(args as never)
    case 'write_file':
      return writeFile(args as never)
    case 'edit_file':
      return editFile(args as never)
    case 'list_dir':
      return listDir(args as never)
    case 'run_command':
      return runCommand(args as never, ctx)
    case 'search':
      return search(args as never)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
