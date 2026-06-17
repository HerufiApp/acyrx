import { useCallback } from 'react'

/**
 * A draggable divider. `orientation="vertical"` is a thin vertical bar that
 * resizes horizontally (column widths); `"horizontal"` resizes vertically
 * (row heights). `onResize` receives the pointer delta in px since the last move.
 */
export default function ResizeHandle({
  orientation,
  onResize
}: {
  orientation: 'vertical' | 'horizontal'
  onResize: (delta: number) => void
}): JSX.Element {
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const vertical = orientation === 'vertical'
      let last = vertical ? e.clientX : e.clientY

      const move = (ev: MouseEvent): void => {
        const cur = vertical ? ev.clientX : ev.clientY
        onResize(cur - last)
        last = cur
      }
      const up = (): void => {
        document.removeEventListener('mousemove', move)
        document.removeEventListener('mouseup', up)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      document.addEventListener('mousemove', move)
      document.addEventListener('mouseup', up)
      document.body.style.cursor = vertical ? 'col-resize' : 'row-resize'
      document.body.style.userSelect = 'none'
    },
    [orientation, onResize]
  )

  return (
    <div
      onMouseDown={onMouseDown}
      className={
        orientation === 'vertical'
          ? 'w-1 shrink-0 cursor-col-resize bg-border hover:bg-accent'
          : 'h-1 shrink-0 cursor-row-resize bg-border hover:bg-accent'
      }
    />
  )
}
