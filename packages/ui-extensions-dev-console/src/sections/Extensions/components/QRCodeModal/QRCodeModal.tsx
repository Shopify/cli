import en from './translations/en.json'
import * as styles from './QRCodeModal.module.scss'
import React, {useCallback, useMemo} from 'react'
import {DuplicateMinor} from '@shopify/polaris-icons'
import {Button, Modal, ModalProps} from '@shopify/polaris'
import {useI18n} from '@shopify/react-i18n'
import copyToClipboard from 'copy-to-clipboard'
import QRCode from 'qrcode.react'
import {toast} from 'react-toastify'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {useExtensionsInternal} from '@/sections/Extensions/hooks/useExtensionsInternal'

export interface QRCodeModalProps extends Pick<ModalProps, 'open' | 'onClose'> {
  url?: string
  title?: string
  type?: ExtensionPayload['surface'] | 'home'
}

export function QRCodeModal({url, title, type, ...modalProps}: QRCodeModalProps) {
  const [i18n] = useI18n({
    id: 'QRCodeModal',
    fallback: en,
  })

  const content = url && title && type ? <QRCodeContent type={type} title={title} url={url} /> : null

  return (
    <Modal title={i18n.translate('title', {title})} {...modalProps} titleHidden sectioned small noScroll>
      {content}
    </Modal>
  )
}

export interface QRCodeContentProps {
  url: string
  title: string
  type: ExtensionPayload['surface'] | 'home'
}

export function QRCodeContent({url, title, type}: QRCodeContentProps) {
  const [i18n] = useI18n({
    id: 'QRCodeModal',
    fallback: en,
  })

  const {
    state: {store, app},
  } = useExtensionsInternal()

  const apiKey = app?.apiKey
  const appUrl = app?.url
  const qrCodeURL = useMemo(() => {
    if (type === 'pos') {
      return `com.shopify.pos://pos-ui-extensions?url=${url}`
    }

    if (type === 'home') {
      return `https://${store}/admin/apps/${apiKey}`
    }

    return `https://${store}/admin/extensions-dev/mobile?url=${url}`
  }, [store, url, apiKey, appUrl])

  const onButtonClick = useCallback(() => {
    if (qrCodeURL && copyToClipboard(qrCodeURL)) {
      toast(i18n.translate('qrcode.copied'), {toastId: `copy-qrcode-${qrCodeURL}`})
    }
  }, [qrCodeURL])

  return (
    <div className={styles.Wrapper}>
      <div className={styles.CopyLink}>
        <Button icon={DuplicateMinor} plain monochrome onClick={onButtonClick}>
          {i18n.translate('qrcode.copy')}
        </Button>
      </div>
      <QRCode value={qrCodeURL} />
      <p>{i18n.translate('qrcode.content', {title})}</p>
    </div>
  )
}
