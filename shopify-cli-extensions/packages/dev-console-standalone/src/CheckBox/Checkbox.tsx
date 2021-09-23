import React from 'react';
import {Checkbox as PolarisCheckbox, CheckboxProps} from '@shopify/polaris';

import * as styles from './Checkbox.css';

export function Checkbox({...checkboxProps}: CheckboxProps) {
  return (
    <div className={styles.ConsoleCheckboxWrapper}>
      <PolarisCheckbox {...checkboxProps} />
    </div>
  );
}
