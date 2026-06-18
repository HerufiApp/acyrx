import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/**
 * Minimal, zero-dependency `.env` loader. Loads KEY=VALUE pairs into
 * process.env so API keys can live in a project `.env` file:
 *
 *   GEMINI_API_KEY=...
 *   ANTHROPIC_API_KEY=...
 *   OPENAI_API_KEY=...
 *   TAVILY_API_KEY=...
 *
 * Supabase auth (gates the AI features) reads:
 *
 *   SUPABASE_URL=https://xxxxx.supabase.co
 *   SUPABASE_ANON_KEY=eyJ...
 *
 * Real environment variables always win — a value already set in the
 * environment is never overwritten by the file.
 */

function parse(content: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line
    const eq = withoutExport.indexOf('=')
    if (eq === -1) continue
    const key = withoutExport.slice(0, eq).trim()
    if (!key) continue
    let value = withoutExport.slice(eq + 1).trim()
    // Strip surrounding single or double quotes.
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

/** Candidate locations, in order. The first existing file wins. */
function candidatePaths(): string[] {
  const paths = [join(process.cwd(), '.env')]
  try {
    // Project root in dev; app bundle root when packaged.
    paths.push(join(app.getAppPath(), '.env'))
  } catch {
    /* app path unavailable */
  }
  return paths
}

export function loadEnv(): void {
  for (const path of candidatePaths()) {
    let content: string
    try {
      content = readFileSync(path, 'utf-8')
    } catch {
      continue
    }
    for (const [key, value] of Object.entries(parse(content))) {
      if (process.env[key] === undefined) process.env[key] = value
    }
    return // first file found wins
  }
}
