import * as styles from './Checkbox.module.scss'
import React from 'react'
import {Checkbox as PolarisCheckbox, CheckboxProps} from '@shopify/polaris'

export function Checkbox({...checkboxProps}: CheckboxProps) {
  return (
    <div className={styles.ConsoleCheckboxWrapper}>
      <PolarisCheckbox {...checkboxProps} />
    </div>
  )
}
