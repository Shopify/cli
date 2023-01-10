import styles from './Backdrop.module.scss'
import React, {Dispatch, SetStateAction} from 'react'

export interface BackdropProps {
  onClick?(): void
  setClosing: Dispatch<SetStateAction<boolean>>
}

export function Backdrop({onClick, setClosing}: BackdropProps) {
  return (
    <>
      {/* TODO: What about Scrolllock? */}
      {/* <ScrollLock /> */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
      <div className={styles.Backdrop} onClick={onClick} />
    </>
  )
}
