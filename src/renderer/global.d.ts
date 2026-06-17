import type { CodexApi } from '@shared/types'

declare global {
  interface Window {
    codex: CodexApi
  }
}

export {}
