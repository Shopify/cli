import styles from './Header.module.scss'
import {CloseButton} from './components'
import React from 'react'

interface HeaderProps {
  id: string
  closing: boolean
  children: React.ReactNode
  onClose(): void
}

export function Header({id, closing, children, onClose}: HeaderProps) {
  return (
    <div className={styles.Header}>
      <div id={id} className={styles.Title}>
        <h2>{children}</h2>
      </div>
      <CloseButton pressed={closing} onClick={onClose} />
    </div>
  )
}
