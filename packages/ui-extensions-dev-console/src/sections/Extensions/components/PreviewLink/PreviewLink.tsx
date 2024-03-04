import * as styles from './PreviewLink.module.scss'
import en from './translations/en.json'
import {useNavigate} from '../../hooks/useNavigate.js'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ClipboardIcon} from '@shopify/polaris-icons'
import {toast} from 'react-toastify'
import {IconButton} from '@/components/IconButton'
import {isEmbedded} from '@/utilities/embedded'

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

  const navigate = useNavigate()

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
        source={ClipboardIcon}
        accessibilityLabel={i18n.translate('iconLabel', {title})}
      />
    </span>
  )
}
