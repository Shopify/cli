import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'

import {PreviewLinks} from './components'
import {Row, Status, View} from '..'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'

interface Props {
  extension: ExtensionPayload
  onHighlight(extension: ExtensionPayload): void
  onClearHighlight(): void
  onShowMobileQRCode(extension: ExtensionPayload): void
}

export function ExtensionRow({extension, onHighlight, onClearHighlight, onShowMobileQRCode}: Props) {
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  })

  return (
    <Row onMouseEnter={() => onHighlight(extension)} onMouseLeave={onClearHighlight}>
      <td>
        <span className={styles.Title}>{extension.title}</span>
      </td>
      <td>
        <PreviewLinks extension={extension} />
      </td>
      <td>
        <Button type="button" onClick={() => onShowMobileQRCode(extension)}>
          {i18n.translate('viewMobile')}
        </Button>
      </td>
      <td>
        <View extension={extension} />
      </td>
      <td>
        <Status status={extension.development.status} />
      </td>
    </Row>
  )
}
