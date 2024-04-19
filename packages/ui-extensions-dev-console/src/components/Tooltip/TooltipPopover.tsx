import styles from './TooltipPopover.module.css'
import React, {useLayoutEffect, useRef} from 'react'

interface Position {
  x: number
  y: number
}

interface TooltipPopoverProps {
  text: string
  targetRef: React.RefObject<HTMLElement>
}

const TOOLTIP_VERTICAL_OFFSET = 10

export function TooltipPopover({targetRef, text}: TooltipPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  const getPositionRelativeToRef = (): Position => {
    if (!targetRef.current) return {x: 0, y: 0}

    const {x, y, height} = targetRef.current.getBoundingClientRect()
    const {scrollY, scrollX} = window

    return {
      x: x + scrollX,
      y: y + height + TOOLTIP_VERTICAL_OFFSET + scrollY,
    }
  }

  useLayoutEffect(() => {
    if (!ref.current || !targetRef?.current) return

    // check if ref is still inside the viewport
    let {x, y} = getPositionRelativeToRef()
    const {innerWidth, innerHeight} = window
    const {height, width} = ref.current.getBoundingClientRect()

    if (x + width > innerWidth) {
      x -= width - targetRef.current.getBoundingClientRect().width
    }

    if (y + height > innerHeight) {
      y -= height + targetRef.current.getBoundingClientRect().height + 2 * TOOLTIP_VERTICAL_OFFSET
    }
    // end check

    ref.current.style.top = `${y}px`
    ref.current.style.left = `${x}px`
  }, [])

  return (
    <div className={styles.Popover} role="tooltip" ref={ref}>
      {text}
    </div>
  )
}
