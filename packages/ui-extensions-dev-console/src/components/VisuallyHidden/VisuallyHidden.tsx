import styles from './VisuallyHidden.module.scss'
import React from 'react'

interface Props {
  children: React.ReactNode
}

export function VisuallyHidden({children}: Props) {
  return <span className={styles.VisuallyHidden}>{children}</span>
}
