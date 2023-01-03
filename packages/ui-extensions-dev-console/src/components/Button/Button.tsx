import * as styles from './Button.module.scss'
import React from 'react'

export interface ButtonProps extends React.HTMLProps<HTMLButtonElement> {
  type: 'button' | 'submit' | 'reset' | undefined
}

export function Button({className, selected, ...props}: ButtonProps) {
  const classNames = `${className ? `${className} ` : ''}${styles.Button}`

  return <button {...props} className={classNames} aria-pressed={selected} />
}
