import { promises as fs } from 'fs'
import { resolveInProject, toRelative } from './tools/paths'

const MAX_FILE_CHARS = 50_000

/**
 * Expand @-mentions in a chat message into an attached-context block. @file
 * inlines the file's contents; @dir/ lists the directory. Unknown refs are
 * ignored. The original message is preserved at the end.
 */
export async function resolveMentions(message: string): Promise<string> {
  const refs = [...message.matchAll(/(?:^|\s)@([^\s]+)/g)].map((m) => m[1])
  const unique = [...new Set(refs)]
  if (unique.length === 0) return message

  const blocks: string[] = []
  for (const raw of unique) {
    const ref = raw.replace(/[.,;:)]+$/, '').replace(/\/$/, '')
    try {
      const abs = resolveInProject(ref)
      const stat = await fs.stat(abs)
      if (stat.isDirectory()) {
        const entries = await fs.readdir(abs, { withFileTypes: true })
        const listing = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join('\n')
        blocks.push(`Directory ${toRelative(abs)}/:\n${listing}`)
      } else {
        let content = await fs.readFile(abs, 'utf-8')
        if (content.length > MAX_FILE_CHARS) content = content.slice(0, MAX_FILE_CHARS) + '\n[...truncated]'
        blocks.push(`File ${toRelative(abs)}:\n\`\`\`\n${content}\n\`\`\``)
      }
    } catch {
      /* ignore mentions that don't resolve to a real path */
    }
  }

  if (blocks.length === 0) return message
  return `The user attached the following context:\n\n${blocks.join('\n\n')}\n\n---\n\n${message}`
}
