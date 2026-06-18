import { getGithubToken } from './settings'

export interface CreatedRepo {
  ok: boolean
  output: string
  /** HTTPS clone URL of the created repo. */
  cloneUrl: string | null
  htmlUrl: string | null
}

/**
 * Create a repository on the authenticated user's GitHub account via the REST API.
 * Requires a token with the `repo` scope.
 */
export async function createRepo(opts: {
  name: string
  description?: string
  private: boolean
}): Promise<CreatedRepo> {
  const token = await getGithubToken()
  if (!token)
    return { ok: false, output: 'No GitHub token configured. Add one in Settings → GitHub.', cloneUrl: null, htmlUrl: null }

  try {
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'Acyrx'
      },
      body: JSON.stringify({
        name: opts.name,
        description: opts.description || undefined,
        private: opts.private,
        auto_init: false
      })
    })
    const data = (await res.json().catch(() => ({}))) as {
      clone_url?: string
      html_url?: string
      message?: string
      errors?: { message?: string }[]
    }
    if (!res.ok) {
      const detail = data.errors?.map((e) => e.message).filter(Boolean).join('; ')
      return {
        ok: false,
        output: detail || data.message || `GitHub API error (${res.status}).`,
        cloneUrl: null,
        htmlUrl: null
      }
    }
    return {
      ok: true,
      output: `Created ${data.html_url}`,
      cloneUrl: data.clone_url ?? null,
      htmlUrl: data.html_url ?? null
    }
  } catch (e) {
    return { ok: false, output: (e as Error).message, cloneUrl: null, htmlUrl: null }
  }
}
