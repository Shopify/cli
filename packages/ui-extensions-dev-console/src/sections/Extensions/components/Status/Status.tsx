import * as styles from './Status.module.scss'
import en from './translations/en.json'

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
      {i18n.translate(`${status}`)}
    </span>
  )
}
