import * as styles from './Button.module.scss'
import React from 'react'
import {classNames} from '@/utilities/css'

export interface ButtonProps extends React.HTMLProps<HTMLButtonElement> {
  type: 'button' | 'submit' | 'reset' | undefined
}

export function Button({className, selected, ...props}: ButtonProps) {
  return <button {...props} className={classNames(className, styles.Button)} aria-pressed={String(selected)} />
}
