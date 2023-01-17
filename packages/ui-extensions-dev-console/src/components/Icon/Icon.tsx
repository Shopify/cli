import styles from './Icon.module.scss'
import {VisuallyHidden} from '../VisuallyHidden/VisuallyHidden.js'
import React from 'react'

export interface IconProps {
  /** The SVG contents to display in the icon (icons should fit in a 20 × 20 pixel viewBox) */
  source: React.FunctionComponent<React.SVGProps<SVGSVGElement>>

  /** Descriptive text to be read to screenreaders */
  accessibilityLabel?: string
}

export function Icon({source, accessibilityLabel}: IconProps) {
  const SourceComponent = source

  return (
    <>
      <VisuallyHidden>{accessibilityLabel}</VisuallyHidden>
      <span className={styles.Icon}>
        <SourceComponent className={styles.Svg} focusable="false" aria-hidden="true" />
      </span>
    </>
  )
}
