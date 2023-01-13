import * as styles from './Row.module.scss'

import React from 'react'
import {classNames} from '@/utilities/css'

interface Props extends React.HTMLProps<HTMLTableRowElement> {
  children: React.ReactNode
}

export function Row({className, children, ...props}: Props) {
  const classes = classNames(
    className,
    styles.Row,
    props.onMouseEnter || props.onMouseLeave ? styles.Hoverable : undefined,
  )

  return (
    <tr className={classes} {...props}>
      {children}
    </tr>
  )
}
