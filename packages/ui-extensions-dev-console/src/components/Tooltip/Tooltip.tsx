import styles from './Tooltip.module.css'
import {TooltipPopover} from './TooltipPopover'
import React, {useRef, useReducer} from 'react'
import type {TooltipProps, TooltipState, TooltipAction} from './types'
import {classNames} from '@/utilities/css'

function tooltipReducer(state: TooltipState, action: TooltipAction) {
  switch (action.type) {
    case 'show':
      return {...state, isVisible: true}
    case 'hide':
      return {...state, isVisible: false}
    case 'position':
      return {...state, position: action.payload}
    default:
      throw new Error()
  }
}

export function Tooltip({children, text}: TooltipProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  const [state, dispatch] = useReducer(tooltipReducer, {
    isVisible: false,
    position: {
      x: 0,
      y: 0,
    },
  })

  const handleShow = () => {
    if (!ref.current || state.isVisible) return

    // This is currently my best solution for avoid the tooltip-wrapped element
    // from needing two tab presses to get past.  I'm not sure if this is the best
    // solution, but it works for now.
    if (typeof children !== 'string') {
      ;(ref.current.firstChild as HTMLElement).tabIndex = -1
    }

    const {x, y, height} = ref.current.getBoundingClientRect()
    const {scrollY, scrollX} = window

    dispatch({
      type: 'position',
      payload: {
        x: x + scrollX,
        y: y + height + 10 + scrollY,
      },
    })

    dispatch({type: 'show'})
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
      onBlur={() => dispatch({type: 'hide'})}
      onMouseLeave={() => dispatch({type: 'hide'})}
      onKeyUp={handleEnter}
      ref={ref}
      tabIndex={0}
    >
      {children}
      {state.isVisible && <TooltipPopover position={state.position} text={text} />}
    </div>
  )
}
