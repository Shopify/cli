import * as styles from './Row.module.scss'

import React from 'react'

interface Props extends React.HTMLProps<HTMLTableRowElement> {
  children: React.ReactNode
}

export function Row({className, children, ...props}: Props) {
  const classNames = `${className ? `${className} ` : ''} ${styles.Row}`

  return (
    <tr className={classNames} {...props}>
      {children}
    </tr>
  )
}
