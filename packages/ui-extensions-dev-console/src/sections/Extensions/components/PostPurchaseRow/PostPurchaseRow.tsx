import * as styles from './PostPurchaseRow.module.scss'
import en from './translations/en.json'

import {Row, Status, View} from '..'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'

interface Props {
  extension: ExtensionPayload
  onHighlight(extension: ExtensionPayload): void
  onClearHighlight(): void
  onOpenPostPurchaseModal(): void
}

export function PostPurchaseRow({extension, onHighlight, onClearHighlight, onOpenPostPurchaseModal}: Props) {
  const [i18n] = useI18n({
    id: 'PostPurchaseRow',
    fallback: en,
  })

  return (
    <Row onMouseEnter={() => onHighlight(extension)} onMouseLeave={onClearHighlight}>
      <td>
        <span className={styles.Title}>{extension.title}</span>
      </td>
      <td>
        <Button type="button" onClick={() => onOpenPostPurchaseModal()}>
          {i18n.translate('viewPreviewInstructions', {type: extension.type})}
        </Button>
      </td>
      <td></td>
      <td>
        <View extension={extension} />
      </td>
      <td>
        <Status status={extension.development.status} />
      </td>
    </Row>
  )
}
