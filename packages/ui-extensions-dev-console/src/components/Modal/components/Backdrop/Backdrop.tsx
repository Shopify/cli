import styles from './Backdrop.module.scss'
import React, {Dispatch, SetStateAction} from 'react'

interface Props {
  onClick(): void
  setClosing: Dispatch<SetStateAction<boolean>>
}

export function Backdrop({onClick, setClosing}: Props) {
  const handleMouseDown = () => {
    setClosing(true)
  }

  const handleMouseUp = () => {
    setClosing(false)
    onClick()
  }

  return (
    <>
      {/* The backdrop is intentionally click-only without keyboard interaction */}
      <div className={styles.Backdrop} onClick={onClick} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} />
    </>
  )
}
