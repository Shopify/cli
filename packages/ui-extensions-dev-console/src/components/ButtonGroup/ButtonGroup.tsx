import styles from './ButtonGroup.module.scss'

import React, {Children, isValidElement} from 'react'

export interface ButtonGroupProps {
  /** Button components */
  children?: React.ReactNode
}

export function ButtonGroup({children}: ButtonGroupProps) {
  const contents = elementChildren(children).map((child, index) => (
    <div className={styles.Item} key={index}>
      {child}
    </div>
  ))

  return <div className={styles.ButtonGroup}>{contents}</div>
}

// Returns all children that are valid elements as an array.
export function elementChildren<T extends React.ReactElement>(children: React.ReactNode): T[] {
  return Children.toArray(children).filter((child) => isValidElement(child)) as T[]
}
