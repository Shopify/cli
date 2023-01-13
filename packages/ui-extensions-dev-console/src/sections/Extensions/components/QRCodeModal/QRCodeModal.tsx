import en from './translations/en.json'
import * as styles from './QRCodeModal.module.scss'
import React, {useCallback, useMemo} from 'react'
import {useI18n} from '@shopify/react-i18n'
import copyToClipboard from 'copy-to-clipboard'
import QRCode from 'qrcode.react'
import {toast} from 'react-toastify'
import {Surface} from '@shopify/ui-extensions-server-kit'
import {ClipboardMinor} from '@shopify/polaris-icons'
import {useExtensionsInternal} from '@/sections/Extensions/hooks/useExtensionsInternal'
import {Modal, ModalProps} from '@/components/Modal'
import {IconButton} from '@/components/IconButton'

interface Code {
  url: string
  title: string
  type: Surface | 'home'
}

export interface QRCodeModalProps extends Pick<ModalProps, 'onClose'> {
  code?: Code
}

export function QRCodeModal({code, onClose}: QRCodeModalProps) {
  const [i18n] = useI18n({
    id: 'QRCodeModal',
    fallback: en,
  })

  return (
    <Modal title={i18n.translate('title', {title: code?.title})} open={Boolean(code)} onClose={onClose}>
      {code ? <QRCodeContent {...code} /> : null}
    </Modal>
  )
}

export function QRCodeContent({url, title, type}: Code) {
  const [i18n] = useI18n({
    id: 'QRCodeModal',
    fallback: en,
  })

  const {
    state: {store, app},
  } = useExtensionsInternal()

  const qrCodeURL = useMemo(() => {
    // The Websocket hasn't loaded data yet.
    // Shouldn't happen since you can't open modal without data,
    // but just in case.
    if (!app) {
      return null
    }

    // View a POS extension in POS app
    if (type === 'pos') {
      return `com.shopify.pos://pos-ui-extensions?url=${url}`
    }

    // View app home (iframe) in mobile app
    if (type === 'home') {
      return app.mobileUrl
    }

    // View a UI extension in mobile app
    return `https://${store}/admin/extensions-dev/mobile?url=${url}`
  }, [store, url, app?.url, app?.mobileUrl])

  const onButtonClick = useCallback(() => {
    if (qrCodeURL && copyToClipboard(qrCodeURL)) {
      toast(i18n.translate('qrcode.copied'), {toastId: `copy-qrcode-${qrCodeURL}`})
    }
  }, [qrCodeURL])

  if (!qrCodeURL) {
    return null
  }

  return (
    <div className={styles.Wrapper}>
      <span>
        <span className={styles.QRCode}>
          <QRCode value={qrCodeURL} />
        </span>
      </span>
      <span className={styles.RightColumn}>
        <p>{i18n.translate('qrcode.content', {title})}</p>
        <div className={styles.CopyLink}>
          <IconButton
            type="button"
            source={ClipboardMinor}
            accessibilityLabel={i18n.translate('qrcode.copy')}
            onClick={onButtonClick}
          />
        </div>
      </span>
    </div>
  )
}
