import * as styles from './Theme.module.scss'
import React from 'react'
import '@shopify/polaris/dist/styles.css'

interface Props {
  children: React.ReactNode
}

export function Theme({children}: Props) {
  return <div className={styles.Theme}>{children}</div>
}
