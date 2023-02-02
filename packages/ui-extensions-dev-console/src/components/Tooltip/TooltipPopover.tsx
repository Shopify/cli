import styles from './TooltipPopover.module.css'
import React, {useRef, useLayoutEffect} from 'react'
import type {TooltipPopoverProps} from './types'

export function TooltipPopover({position, text}: TooltipPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.style.top = `${position.y}px`
      ref.current.style.left = `${position.x}px`
    }
  }, [])

  return (
    <div className={styles.Popover} role="tooltip" ref={ref}>
      {text}
    </div>
  )
}
