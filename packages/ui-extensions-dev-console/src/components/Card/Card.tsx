import * as styles from './Card.module.scss'
import React from 'react'
import {Card as PolarisCard, CardProps} from '@shopify/polaris'

export function Card({...cardProps}: CardProps) {
  return (
    <div className={styles.InfoCard}>
      <PolarisCard {...cardProps} />
    </div>
  )
}
