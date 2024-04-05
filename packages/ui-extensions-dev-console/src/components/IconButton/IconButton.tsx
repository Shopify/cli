import * as styles from './IconButton.module.scss'
import React from 'react'
import {Icon, IconProps} from '@/components/Icon'
import {classNames} from '@/utilities/css'

interface IconButtonProps extends React.HTMLProps<HTMLButtonElement>, IconProps {
  type: 'button' | 'submit' | 'reset' | undefined
}

export function IconButton({className, selected, source, accessibilityLabel, ...props}: IconButtonProps) {
  return (
    <button {...props} className={classNames(className, styles.IconButton)} aria-pressed={selected}>
      <span className={styles.Icon}>
        <Icon source={source} accessibilityLabel={accessibilityLabel} />
      </span>
    </button>
  )
}
