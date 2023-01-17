import * as styles from './PreviewLink.module.scss'
import en from './translations/en.json'
import {useExtensionsInternal} from '../../hooks/useExtensionsInternal.js'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ClipboardMinor} from '@shopify/polaris-icons'
import {toast} from 'react-toastify'
import {IconButton} from '@/components/IconButton'

interface Props {
  rootUrl: string
  resourceUrl?: string
  title: string
}

export function PreviewLink({rootUrl, resourceUrl, title}: Props) {
  const [i18n] = useI18n({
    id: 'PreviewLink',
    fallback: en,
  })

  const {embedded, navigate} = useExtensionsInternal()
  const isEmbedded = embedded && window.top

  const handleOpenRoot = (event: React.MouseEvent<HTMLElement>) => {
    if (isEmbedded && resourceUrl) {
      navigate(resourceUrl)
      event.preventDefault()
    }
  }

  function handleCopyPreviewLink() {
    navigator.clipboard
      .writeText(rootUrl)
      .then(() => {
        toast(i18n.translate('copy.success'), {toastId: `copy-${rootUrl}`})
      })
      .catch(() => {
        toast(i18n.translate('copy.error'), {type: 'error', toastId: `copy-${rootUrl}-error`})
      })
  }

  return (
    <span className={styles.PreviewLink}>
      <a
        href={rootUrl}
        target={isEmbedded ? '_top' : '_blank'}
        aria-label={i18n.translate('linkLabel', {title})}
        onClick={handleOpenRoot}
      >
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
