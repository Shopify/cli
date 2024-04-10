import * as styles from './Button.module.scss'
import {Icon, IconProps} from '../Icon/Icon.js'
import React from 'react'
import {classNames} from '@/utilities/css'

interface ButtonProps extends React.HTMLProps<HTMLButtonElement> {
  icon?: {
    source: IconProps['source']
    position: 'left' | 'right'
  }
  type: 'button' | 'submit' | 'reset' | undefined
}

export function Button({className, selected, icon, children, ...props}: ButtonProps) {
  const iconMarkup = icon ? (
    <span className={styles.Icon}>
      <Icon source={icon.source} />
    </span>
  ) : null

  return (
    <button
      {...props}
      className={classNames(icon && styles.WithIcon, styles.Button, className)}
      aria-pressed={selected}
    >
      {icon && icon.position === 'left' && iconMarkup}
      <span>{children}</span>
      {icon && icon.position === 'right' && iconMarkup}
    </button>
  )
}
