import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'
import {useExtensionsInternal} from '../../hooks/useExtensionsInternal.js'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'
import {ButtonGroup} from '@/components/ButtonGroup'

export interface ExtensionRowProps {
  extension: ExtensionPayload
  onHighlight(extension: ExtensionPayload): void
  onClearHighlight(): void
  onShowMobileQRCode(extension: ExtensionPayload): void
}

export function ExtensionRow({extension, onHighlight, onClearHighlight, onShowMobileQRCode}: ExtensionRowProps) {
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  })
  const {
    development: {status},
  } = extension

  const statusClass = status ? styles[status || 'error'] : styles.error
  const {show, hide} = useExtensionsInternal()

  return (
    <tr className={styles.DevToolRow} onMouseEnter={() => onHighlight(extension)} onMouseLeave={onClearHighlight}>
      <td>
        <span className={styles.Title}>{extension.title}</span>
      </td>
      <td className={styles.PreviewLinkCell}>{previewLink}</td>
      <td>
        <Button type="button" onClick={() => onShowMobileQRCode(extension)}>
          View mobile
        </Button>
      </td>
      <td>
        <ButtonGroup>
          <Button type="button" selected={!extension.development.hidden} onClick={() => show([extension])}>
            Local
          </Button>
          <Button type="button" selected={extension.development.hidden} onClick={() => hide([extension])}>
            Live
          </Button>
        </ButtonGroup>
      </td>
      <td>
        <span className={`${styles.Status} ${statusClass}`}>{i18n.translate(`statuses.${status}`)}</span>
      </td>
    </tr>
  )
}
