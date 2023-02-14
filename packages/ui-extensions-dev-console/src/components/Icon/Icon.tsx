import styles from './Icon.module.scss'
import {VisuallyHidden} from '../VisuallyHidden/VisuallyHidden.js'
import React from 'react'
import {classNames} from '@/utilities/css'

export interface IconProps {
  /** The SVG contents to display in the icon (icons should fit in a 20 × 20 pixel viewBox) */
  source: React.FunctionComponent<React.SVGProps<SVGSVGElement>>

  /** Descriptive text to be read to screenreaders */
  accessibilityLabel?: string

  /** Causes the SVG to be filled with a muted grey */
  muted?: boolean
}

export function Icon({source, accessibilityLabel, muted = false}: IconProps) {
  const SourceComponent = source

  return (
    <>
      <VisuallyHidden>{accessibilityLabel}</VisuallyHidden>
      <span className={styles.Icon}>
        <SourceComponent
          className={classNames(styles.Svg, muted && styles.Muted)}
          focusable="false"
          aria-hidden="true"
        />
      </span>
    </>
  )
}
