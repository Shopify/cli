import * as styles from './IconButton.module.scss'
import React from 'react'
import {Icon, IconProps} from '@/components/Icon'

export interface ButtonProps extends React.HTMLProps<HTMLButtonElement>, IconProps {
  type: 'button' | 'submit' | 'reset' | undefined
}

export function IconButton({className, selected, source, accessibilityLabel, ...props}: ButtonProps) {
  const classNames = `${className ? `${className} ` : ''}${styles.IconButton}`

  return (
    <button {...props} className={classNames} aria-pressed={selected}>
      <span className={styles.Icon}>
        <Icon source={source} accessibilityLabel={accessibilityLabel} />
      </span>
    </button>
  )
}
