import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'
import {ActionSet, ActionSetProps} from '../ActionSet'
import {useExtensionsInternal} from '../../hooks/useExtensionsInternal.js'
import React, {MouseEvent, useCallback, useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Link} from '@shopify/polaris'
import {ClipboardMinor} from '@shopify/polaris-icons'
import {Checkbox} from '@/components/CheckBox'
import {Action} from '@/components/Action/Action'
import {useToast} from '@/hooks/useToast.js'

export type ExtensionRowProps = {
  extension: ExtensionPayload
  selected?: boolean
  onSelect(extension: ExtensionPayload): void
  onHighlight(extension: ExtensionPayload): void
  onClearHighlight(): void
} & Pick<ActionSetProps, 'onShowMobileQRCode' | 'onCloseMobileQRCode'>

export function ExtensionRow({
  extension,
  selected,
  onSelect,
  onHighlight,
  onClearHighlight,
  ...actionSetProps
}: ExtensionRowProps) {
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  })
  const {
    development: {hidden, status},
  } = extension

  const handleSelect = useCallback(
    (event?: MouseEvent) => {
      if (event) event.stopPropagation()
      onSelect(extension)
    },
    [extension, onSelect],
  )

  const showToast = useToast()

  const [isFocus, setFocus] = useState(false)

  const textClass = hidden ? styles.Hidden : undefined
  const statusClass = status ? styles[status || 'error'] : styles.error
  const {embedded, navigate} = useExtensionsInternal()

  const handleOpenRoot = useCallback(() => {
    const roolUrl = extension.development.root.url
    if (embedded && window.top) {
      navigate(extension)
      return
    }
    window.open(roolUrl, '_blank')
  }, [embedded, extension, navigate])

  async function handleCopyUrl() {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      showToast({
        content: i18n.translate('copy.toast'),
      })
      return navigator.clipboard.writeText(extension.development.root.url)
    }
  }

  return (
    <tr
      className={styles.DevToolRow}
      onClick={handleSelect}
      onFocus={() => {
        setFocus(true)
      }}
      onBlur={() => {
        setFocus(false)
      }}
      onMouseEnter={() => onHighlight(extension)}
      onMouseLeave={onClearHighlight}
    >
      <td>
        {
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <div onClick={(event) => event.stopPropagation()}>
            <Checkbox label="" checked={selected} onChange={() => handleSelect()} />
          </div>
        }
      </td>
      {/* TODO: This is ugly.  Might not matter if we removed the checkboxes in the row */}
      <td className={textClass} onClick={(event) => event.stopPropagation()}>
        <span className={styles.UrlWrapper}>
          <Link url={extension.development.root.url} external onClick={handleOpenRoot}>
            {extension.title}
          </Link>
          <Action source={ClipboardMinor} accessibilityLabel={i18n.translate('copy.label')} onAction={handleCopyUrl} />
        </span>
      </td>
      <td className={textClass}>{extension.externalType}</td>
      <td>
        <span className={`${styles.Status} ${statusClass}`}>{i18n.translate(`statuses.${status}`)}</span>
      </td>
      <ActionSet
        className={`${styles.ActionSet} ${isFocus ? styles.ForceVisible : ''}`}
        selected={selected}
        extension={extension}
        {...actionSetProps}
      />
    </tr>
  )
}
