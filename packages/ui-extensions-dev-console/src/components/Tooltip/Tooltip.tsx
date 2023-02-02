import styles from './Tooltip.module.css'
import React, {useRef, useReducer, useLayoutEffect} from 'react'

interface Position {
  x: number
  y: number
}

interface TooltipPopoverProps {
  position: Position
  text: string
}

interface TooltipProps {
  children: JSX.Element
  text: string
}

interface TooltipState {
  isVisible: boolean
  position: Position
}

type TooltipAction = {type: 'show' | 'hide'} | {type: 'position'; payload: Position}

function TooltipPopover({position, text}: TooltipPopoverProps) {
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
