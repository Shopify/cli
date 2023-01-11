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
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div className={styles.Backdrop} onClick={onClick} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} />
    </>
  )
}
