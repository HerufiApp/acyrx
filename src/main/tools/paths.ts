import { resolve, relative, isAbsolute, sep } from 'path'
import { getProjectRoot } from '../projectState'

/**
 * Resolve a project-relative path to an absolute path, refusing any path that
 * escapes the open project root. Every filesystem tool funnels through this.
 */
export function resolveInProject(p: string | undefined): string {
  const root = getProjectRoot()
  if (!root) throw new Error('No project folder is open. Ask the user to open a folder first.')
  const target = resolve(root, p && p.length ? p : '.')
  const rel = relative(root, target)
  if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
    throw new Error(`Path "${p}" escapes the project root and is not allowed.`)
  }
  return target
}

/** Convert an absolute path back to a forward-slash project-relative path. */
export function toRelative(abs: string): string {
  const root = getProjectRoot()
  if (!root) return abs
  const rel = relative(root, abs)
  return rel.split(sep).join('/')
}
