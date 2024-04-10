import styles from './Tooltip.module.css'
import {TooltipPopover} from './TooltipPopover'
import React, {useRef, useState} from 'react'
import {classNames} from '@/utilities/css'

interface TooltipProps {
  children: JSX.Element | string
  text: string
}

export function Tooltip({children, text}: TooltipProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  const [isVisible, setIsVisible] = useState(false)

  const handleShow = () => {
    if (!ref.current || isVisible) return

    // This is currently my best solution for avoid the tooltip-wrapped element
    // from needing two tab presses to get past.  I'm not sure if this is the best
    // solution, but it works for now.
    if (typeof children !== 'string') {
      ;(ref.current.firstChild as HTMLElement).tabIndex = -1
    }

    setIsVisible(true)
  }

  // This is part of the double-tab solution menmtioned above. Since we will
  // never tab to the child, we can use the enter key to trigger the click.
  // Foreseeable problem: if the child is an input, we will need to write a
  // special case for that.  Off the top of my head, we could probably just have a
  // boolean prop that disables this behavior.
  const handleEnter = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter') {
      ;(ref.current?.firstChild as HTMLElement).click()
    }
  }

  return (
    <div
      className={classNames(styles.Tooltip, typeof children === 'string' && styles.TooltipUnderline)}
      onMouseEnter={handleShow}
      onFocus={handleShow}
      onBlur={() => setIsVisible(false)}
      onMouseLeave={() => setIsVisible(false)}
      onKeyUp={handleEnter}
      ref={ref}
      tabIndex={0}
    >
      {children}
      {isVisible && <TooltipPopover text={text} targetRef={ref} />}
    </div>
  )
}
