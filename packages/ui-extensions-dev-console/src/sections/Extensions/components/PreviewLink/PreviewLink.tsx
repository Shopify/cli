import * as styles from './PreviewLink.module.scss'
import en from './translations/en.json'
import {useExtensionsInternal} from '../../hooks/useExtensionsInternal.js'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ClipboardMinor} from '@shopify/polaris-icons'
import {toast} from 'react-toastify'
import {IconButton} from '@/components/IconButton'

interface Props {
  url: string
  title: string
}

export function PreviewLink({url, title}: Props) {
  const [i18n] = useI18n({
    id: 'PreviewLink',
    fallback: en,
  })

  const {embedded} = useExtensionsInternal()

  const handleOpenRoot = (event: React.MouseEvent<HTMLElement>) => {
    if (embedded && window.top) {
      // TODO: Is this a secure way to do this?
      // Get thumbs up from some peoples
      window.parent.location = url

      event.preventDefault()
    }
  }

  function handleCopyPreviewLink() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast(i18n.translate('copy.success'), {toastId: `copy-${url}`})
      })
      .catch(() => {
        toast(i18n.translate('copy.error'), {type: 'error', toastId: `copy-${url}-error`})
      })
  }

  return (
    <span className={styles.PreviewLink}>
      <a href={url} target="_blank" aria-label={i18n.translate('linkLabel', {title})} onClick={handleOpenRoot}>
        {title}
      </a>
      <IconButton
        type="button"
        onClick={() => handleCopyPreviewLink()}
        source={ClipboardMinor}
        accessibilityLabel={i18n.translate('iconLabel', {title})}
      />
    </span>
  )
}
