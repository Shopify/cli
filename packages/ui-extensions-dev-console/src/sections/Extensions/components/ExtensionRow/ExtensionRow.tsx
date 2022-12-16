import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'
import {ActionSet, ActionSetProps} from '../ActionSet'
import {useExtensionsInternal} from '../../hooks/useExtensionsInternal.js'
import React, {useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'

export type ExtensionRowProps = {
  extension: ExtensionPayload
  onHighlight(extension: ExtensionPayload): void
  onClearHighlight(): void
} & Pick<ActionSetProps, 'onShowMobileQRCode'>

export function ExtensionRow({extension, onHighlight, onClearHighlight, ...actionSetProps}: ExtensionRowProps) {
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  })
  const {
    development: {hidden, status},
  } = extension

  const [isFocus, setFocus] = useState(false)

  const textClass = hidden ? styles.Hidden : undefined
  const statusClass = status ? styles[status || 'error'] : styles.error
  const {embedded, navigate} = useExtensionsInternal()

  const handleOpenRoot = (event: React.MouseEvent<HTMLElement>) => {
    if (embedded && window.top) {
      navigate(extension)
      event.preventDefault()
    }
  }

  return (
    <tr
      className={styles.DevToolRow}
      onFocus={() => {
        setFocus(true)
      }}
      onBlur={() => {
        setFocus(false)
      }}
      onMouseEnter={() => onHighlight(extension)}
      onMouseLeave={onClearHighlight}
    >
      <td className={textClass}>
        <span className={styles.Title}>{extension.title}</span>
      </td>
      <td className={textClass}>
        <a
          href={extension.development.root.url}
          target="_blank"
          aria-label="Preview this extension"
          onClick={handleOpenRoot}
        >
          {extension.type.replaceAll('_', ' ')}
        </a>
      </td>
      <td className={textClass}>{extension.externalType}</td>
      <td>
        <span className={`${styles.Status} ${statusClass}`}>{i18n.translate(`statuses.${status}`)}</span>
      </td>
      <ActionSet
        className={`${styles.ActionSet} ${isFocus ? styles.ForceVisible : ''}`}
        extension={extension}
        {...actionSetProps}
      />
    </tr>
  )
}
