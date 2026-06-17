import type { ToolSpec } from './types'

/** Provider-agnostic tool specifications (converted per provider). */
export const toolSpecs: ToolSpec[] = [
  {
    name: 'read_file',
    description:
      'Read the full contents of a text file within the project. Use this before editing a file so your edits match its exact current contents.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the project root (e.g. "src/index.ts").' }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description:
      'Create a new file or completely overwrite an existing file. The user must approve the change before it is applied. Prefer edit_file for small targeted changes.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the project root.' },
        content: { type: 'string', description: 'The full new contents of the file.' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'edit_file',
    description:
      'Replace an exact, unique occurrence of old_str with new_str in an existing file. old_str must appear exactly once. The user must approve the change.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path relative to the project root.' },
        old_str: {
          type: 'string',
          description:
            'Exact text to replace (must match the file exactly and be unique; include surrounding context).'
        },
        new_str: { type: 'string', description: 'The replacement text.' }
      },
      required: ['path', 'old_str', 'new_str']
    }
  },
  {
    name: 'list_dir',
    description: 'List files and subdirectories of a directory within the project.',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Directory path relative to the project root. Omit or use "." for the root.'
        }
      }
    }
  },
  {
    name: 'run_command',
    description:
      'Run a shell command in the project root and return its output (also streamed to the terminal). Destructive-looking commands require user confirmation.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute (e.g. "npm test").' }
      },
      required: ['command']
    }
  },
  {
    name: 'search',
    description:
      'Search the project for a regular-expression pattern, returning matching lines with file and line number.',
    parameters: {
      type: 'object',
      properties: {
        pattern: { type: 'string', description: 'The regular-expression pattern to search for.' }
      },
      required: ['pattern']
    }
  },
  {
    name: 'git_status',
    description: 'Show the git status of the project (branch, staged and unstaged changes).',
    parameters: { type: 'object', properties: {} }
  },
  {
    name: 'git_diff',
    description: 'Show the git diff of the working tree (or staged changes, or a single file).',
    parameters: {
      type: 'object',
      properties: {
        staged: { type: 'boolean', description: 'If true, show staged changes (git diff --cached).' },
        path: { type: 'string', description: 'Optional file path to limit the diff to.' }
      }
    }
  },
  {
    name: 'git_commit',
    description:
      'Create a git commit with the given message. Set all=true to stage all changes first (git add -A).',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The commit message.' },
        all: { type: 'boolean', description: 'Stage all changes before committing.' }
      },
      required: ['message']
    }
  }
]
