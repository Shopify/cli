import * as styles from './PreviewLink.module.scss'
import en from './translations/en.json'
import {useNavigate} from '../../hooks/useNavigate.js'
import React, {useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ClipboardIcon} from '@shopify/polaris-icons'
import {toast} from 'react-toastify'
import {IconButton} from '@/components/IconButton'
import {isEmbedded} from '@/utilities/embedded'

interface Props {
  rootUrl: string
  resourceUrl?: string
  title: string
  extension?: any
}

export function PreviewLink({rootUrl, resourceUrl, title, extension}: Props) {
  const [i18n] = useI18n({
    id: 'PreviewLink',
    fallback: en,
  })
  const [blah, setBlah] = useState(false)

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
    <>
      {extension?.sayBlah ? (
        <span>
          <label htmlFor={title}>BLAH </label>
          <input
            id={title}
            type="checkbox"
            onChange={() => {
              const nextBlah = !blah
              setBlah(nextBlah)
              if (extension?.sayBlah) {
                extension.sayBlah(nextBlah)
              }
            }}
          />
        </span>
      ) : null}
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
    </>
  )
}
