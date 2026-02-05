import en from './translations/en.json'
import * as styles from './Status.module.scss'
import {Tooltip} from '@/components/Tooltip'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {Status as StatusProp} from '@shopify/ui-extensions-server-kit'

interface Props {
  status: StatusProp
}

export function Status({status}: Props) {
  const [i18n] = useI18n({
    id: 'Status',
    fallback: en,
  })

  const statusClass = status ? styles[status || 'error'] : styles.error

  return (
    <span className={styles.Status}>
      <span className={statusClass}></span>
      <Tooltip text={i18n.translate(`${status}.tooltipMessage`)}>{i18n.translate(`${status}.label`)}</Tooltip>
    </span>
  )
}
