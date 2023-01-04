import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'
import {useExtensionsInternal} from '../../hooks/useExtensionsInternal.js'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {ClipboardMinor} from '@shopify/polaris-icons'
import {Button} from '@/components/Button'
import {ButtonGroup} from '@/components/ButtonGroup'
import {IconButton} from '@/components/IconButton'

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
  const {embedded, navigate, show, hide} = useExtensionsInternal()

  const handleOpenRoot = (event: React.MouseEvent<HTMLElement>) => {
    if (embedded && window.top) {
      navigate(extension)
      event.preventDefault()
    }
  }

  function handleCopyPreviewLink() {
    navigator.clipboard
      .writeText(extension.development.root.url)
      .then(() => {})
      .catch(() => {})
  }

  const previewLink =
    extension.surface === 'pos' ? (
      <span className={styles.NotApplicable}>--</span>
    ) : (
      <>
        <a
          href={extension.development.root.url}
          target="_blank"
          aria-label="Preview this extension"
          onClick={handleOpenRoot}
        >
          {extension.type.replaceAll('_', ' ')}
        </a>
        <IconButton
          type="button"
          onClick={() => handleCopyPreviewLink()}
          source={ClipboardMinor}
          accessibilityLabel={`Copy preview link for ${extension.title}`}
        />
      </>
    )

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
