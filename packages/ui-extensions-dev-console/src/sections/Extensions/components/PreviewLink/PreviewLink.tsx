import * as styles from './PreviewLink.module.scss'
import en from './translations/en.json'
import {useNavigate} from '../../hooks/useNavigate.js'
import React, {useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ClipboardIcon, MobileIcon} from '@shopify/polaris-icons'
import {toast} from 'react-toastify'
import {IconButton} from '@/components/IconButton'
import {isEmbedded} from '@/utilities/embedded'
import {Surface} from '@shopify/ui-extensions-server-kit'
import {QRCodeModal} from '../QRCodeModal'

interface Props {
  rootUrl: string
  resourceUrl?: string
  title: string
  hasLink?: boolean
  surface?: Surface // Surface to determine if this is a POS extension
  target?: string // Target for POS extension deeplinking
}

export function PreviewLink({rootUrl, resourceUrl, title, hasLink = true, surface, target}: Props) {
  const [showQRModal, setShowQRModal] = useState(false)
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

  function handleActionButtonClick() {
    // For POS extensions, show QR code modal
    if (surface === 'point_of_sale') {
      setShowQRModal(true)
    } else {
      // For other extensions, copy the URL to clipboard
      navigator.clipboard
        .writeText(rootUrl)
        .then(() => {
          toast(i18n.translate('copy.success'), {toastId: `copy-${rootUrl}`})
        })
        .catch(() => {
          toast(i18n.translate('copy.error'), {type: 'error', toastId: `copy-${rootUrl}-error`})
        })
    }
  }

  return (
    <>
      <span className={styles.PreviewLink}>
        {hasLink ? (
          <a
            href={surface === 'point_of_sale' ? '#' : rootUrl}
            target={isEmbedded ? '_top' : '_blank'}
            aria-label={i18n.translate('linkLabel', {title})}
            onClick={handleOpenRoot}
          >
            {title}
          </a>
        ) : (
          title
        )}
        <IconButton
          type="button"
          onClick={handleActionButtonClick}
          source={surface === 'point_of_sale' ? MobileIcon : ClipboardIcon}
          accessibilityLabel={
            surface === 'point_of_sale'
              ? i18n.translate('qrLabel', {title})
              : i18n.translate('iconLabel', {title})
          }
        />
      </span>
      {surface === 'point_of_sale' && (
        <QRCodeModal
          code={
            showQRModal
              ? {
                  url: rootUrl,
                  type: 'point_of_sale',
                  title: target || title,
                  // Don't pass target since rootUrl already includes it at the end
                }
              : undefined
          }
          onClose={() => setShowQRModal(false)}
        />
      )}
    </>
  )
}
