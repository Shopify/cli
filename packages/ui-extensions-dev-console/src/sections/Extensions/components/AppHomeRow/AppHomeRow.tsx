import * as styles from './AppHomeRow.module.scss'
import en from './translations/en.json'

import {NotApplicable, PreviewLink, Row} from '..'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {Button} from '@/components/Button'

interface Props {
  url: string
  title: string
}

export function AppHomeRow({url, title}: Props) {
  const [i18n] = useI18n({
    id: 'AppHomeRow',
    fallback: en,
  })

  return (
    <Row>
      <td>
        <span className={styles.Title}>{title}</span>
      </td>
      <td>
        <PreviewLink url={url} title={'App home'} />
      </td>
      <td>
        {/* TODO: Hook this up correctly */}
        <Button type="button" onClick={() => onShowMobileQRCode(extension)}>
          {i18n.translate('viewMobile')}
        </Button>
      </td>
      <td>
        <NotApplicable />
      </td>
      <td>
        <NotApplicable />
      </td>
    </Row>
  )
}
