import * as styles from './PostPurchaseExtensionRow.module.scss'
import en from './translations/en.json'
import React, {MouseEvent, useCallback} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Link} from '@shopify/polaris'
import {Checkbox} from '@/components/CheckBox'

export interface Props {
  extension: ExtensionPayload
  selected?: boolean
  onSelect(extension: ExtensionPayload): void
  onHighlight(extension: ExtensionPayload): void
  onClearHighlight(): void
  onShowInstructionsModal(extension: ExtensionPayload): void
}

export function PostPurchaseExtensionRow({
  extension,
  selected,
  onSelect,
  onHighlight,
  onClearHighlight,
  onShowInstructionsModal,
}: Props) {
  const [i18n] = useI18n({
    id: 'PostPurchaseExtensionRow',
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

  const textClass = hidden ? styles.Hidden : undefined
  const statusClass = status ? styles[status || 'error'] : styles.error

  return (
    <tr
      className={styles.DevToolRow}
      onClick={handleSelect}
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
      <td className={textClass}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
        <div onClick={(event) => event.preventDefault()}>
          Post Purchase <Link onClick={() => onShowInstructionsModal(extension)}>Preview Instructions</Link>
        </div>
      </td>
      <td className={textClass}>{extension.externalType}</td>
      <td>
        <span className={`${styles.Status} ${statusClass}`}>{i18n.translate(`statuses.${status}`)}</span>
      </td>
      <td></td>
    </tr>
  )
}
