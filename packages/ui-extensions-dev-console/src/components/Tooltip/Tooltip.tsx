import styles from './Tooltip.module.css'
import React, {useRef, useReducer} from 'react'

interface TooltipPopoverProps {
  position: {
    x: number
    y: number
  }
  text: string
}

interface TooltipProps {
  children: JSX.Element
  text: string
}

interface TooltipState {
  isVisible: boolean
  position: {
    x: number
    y: number
  }
}

function TooltipPopover({position, text}: TooltipPopoverProps) {
  return (
    <div className={styles.Popover} style={{top: position.y, left: position.x}} role="tooltip">
      {text}
    </div>
  )
}

function tooltipReducer(state: TooltipState, action: any) {
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
        style={{border: '1px solid red'}}
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
