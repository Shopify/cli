import styles from './Tooltip.module.css'
import {TooltipPopover} from './TooltipPopover'
import React, {useRef, useReducer} from 'react'
import type {TooltipProps, TooltipState, TooltipAction} from './types'

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
    <>
      <div
        className={styles.Tooltip}
        onMouseEnter={handleShow}
        onFocus={handleShow}
        onBlur={() => dispatch({type: 'hide'})}
        onMouseLeave={() => dispatch({type: 'hide'})}
        ref={ref}
      >
        {children}
        {state.isVisible && <TooltipPopover position={state.position} text={text} />}
      </div>
    </>
  )
}
