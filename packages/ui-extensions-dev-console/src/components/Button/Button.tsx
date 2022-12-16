import * as styles from './Button.module.scss'
import React from 'react'

export interface ButtonProps extends React.HTMLProps<HTMLButtonElement> {
  type: 'button' | 'submit' | 'reset' | undefined
}

export function Button({className, ...props}: ButtonProps) {
  return <button {...props} className={`${className ? className : ''} ${styles.Button}`} />
}
