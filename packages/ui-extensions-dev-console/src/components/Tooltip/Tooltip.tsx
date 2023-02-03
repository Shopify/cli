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

    // This is necessary to avoid tabbing to the tooltip wrapper and
    // then its contents.  This will cause a tooltip that wraps something
    // like a link to immediately focus the link on tab.
    if (typeof children !== 'string') {
      ;(ref.current.firstChild as HTMLElement).focus()
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

  return (
    <div
      className={classNames(styles.Tooltip, typeof children === 'string' && styles.TooltipUnderline)}
      onMouseEnter={handleShow}
      onFocus={handleShow}
      onBlur={() => dispatch({type: 'hide'})}
      onMouseLeave={() => dispatch({type: 'hide'})}
      ref={ref}
      tabIndex={0}
    >
      {children}
      {state.isVisible && <TooltipPopover position={state.position} text={text} />}
    </div>
  )
}
