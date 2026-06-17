import chokidar, { type FSWatcher } from 'chokidar'
import { relative, sep } from 'path'
import { emitFsChange } from './projectState'
import type { FsChangeEvent } from '@shared/types'

let watcher: FSWatcher | null = null

export function startWatcher(root: string): void {
  stopWatcher()
  watcher = chokidar.watch(root, {
    ignored: /(^|[/\\])(\.git|node_modules|dist|out|release|\.cache)([/\\]|$)/,
    ignoreInitial: true,
    persistent: true,
    depth: 16
  })

  const forward =
    (event: FsChangeEvent) =>
    (p: string): void => {
      const rel = relative(root, p).split(sep).join('/')
      emitFsChange({ event, path: rel })
    }

  watcher
    .on('add', forward('add'))
    .on('change', forward('change'))
    .on('unlink', forward('unlink'))
    .on('addDir', forward('addDir'))
    .on('unlinkDir', forward('unlinkDir'))
}

export function stopWatcher(): void {
  if (watcher) {
    void watcher.close()
    watcher = null
  }
}
