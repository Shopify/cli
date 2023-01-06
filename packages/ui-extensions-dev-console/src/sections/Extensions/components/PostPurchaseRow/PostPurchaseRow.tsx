import * as styles from './PostPurchaseRow.module.scss'
import en from './translations/en.json'

import {useExtensionsInternal} from '../../hooks/useExtensionsInternal'
import {Row, Status} from '..'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'
import {ButtonGroup} from '@/components/ButtonGroup'

interface Props {
  extension: ExtensionPayload
  onHighlight(extension: ExtensionPayload): void
  onClearHighlight(): void
}

export function PostPurchaseRow({extension, onHighlight, onClearHighlight}: Props) {
  const [i18n] = useI18n({
    id: 'PostPurchaseRow',
    fallback: en,
  })

  const {show, hide} = useExtensionsInternal()

  return (
    <Row onMouseEnter={() => onHighlight(extension)} onMouseLeave={onClearHighlight}>
      <td>
        <span className={styles.Title}>{extension.title}</span>
      </td>
      <td>
        <Button type="button">{i18n.translate('viewPreviewInstructions', {type: extension.type})}</Button>
      </td>
      <td></td>
      <td>
        <ButtonGroup>
          <Button type="button" selected={!extension.development.hidden} onClick={() => show([extension])}>
            {i18n.translate('local')}
          </Button>
          <Button type="button" selected={extension.development.hidden} onClick={() => hide([extension])}>
            {i18n.translate('live')}
          </Button>
        </ButtonGroup>
      </td>
      <td>
        <Status status={extension.development.status} />
      </td>
    </Row>
  )
}
