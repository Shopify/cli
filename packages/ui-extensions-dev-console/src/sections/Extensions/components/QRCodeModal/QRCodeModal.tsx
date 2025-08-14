import en from './translations/en.json'
import * as styles from './QRCodeModal.module.scss'
import {useApp} from '../../hooks/useApp'
import React, {useCallback, useMemo} from 'react'
import {useI18n} from '@shopify/react-i18n'
import copyToClipboard from 'copy-to-clipboard'
import QRCode from 'qrcode.react'
import {toast} from 'react-toastify'
import {Surface} from '@shopify/ui-extensions-server-kit'
import {ClipboardIcon} from '@shopify/polaris-icons'
import {Modal, ModalProps} from '@/components/Modal'
import {IconButton} from '@/components/IconButton'

interface Code {
  url: string
  title: string
  type: Surface | 'home'
  target?: string // Optional target for deeplinking to specific extension points
}

interface QRCodeModalProps extends Pick<ModalProps, 'onClose'> {
  code?: Code
}

export function QRCodeModal({code, onClose}: QRCodeModalProps) {
  const [i18n] = useI18n({
    id: 'QRCodeModal',
    fallback: en,
  })

  return (
    <Modal title={i18n.translate('title', {title: code?.title})} open={Boolean(code)} onClose={onClose} width="small">
      {code ? <QRCodeContent {...code} /> : null}
    </Modal>
  )
}

function QRCodeContent({url, type, target}: Code) {
  const [i18n] = useI18n({
    id: 'QRCodeModal',
    fallback: en,
  })

  const {store, app} = useApp()

  const qrCodeURL = useMemo(() => {
    // The Websocket hasn't loaded data yet.
    // Shouldn't happen since you can't open modal without data,
    // but just in case.
    if (!app) {
      return null
    }

    // View a POS extension in POS app
    if (type === 'point_of_sale') {
      let posUrl = `com.shopify.pos://pos-ui-extensions?url=${url}`

      // Append target for deeplinking when no WSS connection is established
      // This allows the POS app to navigate directly to the specific extension target
      if (target) {
        posUrl += `&target=${encodeURIComponent(target)}`
      }

      return posUrl
    }

    // View app home (iframe) in mobile app
    if (type === 'home') {
      return app.mobileUrl
    }

    // View a UI extension in mobile app
    return `https://${store}/admin/extensions-dev/mobile?url=${url}`
  }, [url, app, app?.mobileUrl, target, store, type])

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
      <span className={styles.LeftColumn}>
        <span className={styles.QRCode}>
          <QRCode value={qrCodeURL} size={170} />
        </span>
      </span>
      <span className={styles.RightColumn}>
        {i18n.translate('right.one')}
        <span className={styles.UrlCta}>
          {i18n.translate('right.two')}{' '}
          <IconButton
            type="button"
            source={ClipboardIcon}
            accessibilityLabel={i18n.translate('qrcode.copy')}
            onClick={onButtonClick}
          />
        </span>
      </span>
    </div>
  )
}
