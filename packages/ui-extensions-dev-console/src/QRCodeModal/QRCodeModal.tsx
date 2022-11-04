import en from './translations/en.json'
import * as styles from './QRCodeModal.module.scss'
import React, {useCallback, useMemo} from 'react'
import {CircleAlertMajor, DuplicateMinor} from '@shopify/polaris-icons'
import {Button, Icon, Modal, ModalProps, Stack} from '@shopify/polaris'
import {useI18n} from '@shopify/react-i18n'
import copyToClipboard from 'copy-to-clipboard'
import QRCode from 'qrcode.react'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {useDevConsoleInternal} from '@/hooks/useDevConsoleInternal'
import {useToast} from '@/hooks/useToast'

export interface QRCodeModalProps extends Pick<ModalProps, 'open' | 'onClose'> {
  extension?: ExtensionPayload
}

export function QRCodeModal({extension, open, onClose}: QRCodeModalProps) {
  const [i18n] = useI18n({
    id: 'QRCodeModal',
    fallback: en,
  })

  return (
    <Modal title={i18n.translate('title')} titleHidden open={open} onClose={onClose} sectioned small noScroll>
      <QRCodeContent extension={extension} />
    </Modal>
  )
}

export function QRCodeContent(props: Pick<QRCodeModalProps, 'extension'>) {
  const [i18n] = useI18n({
    id: 'QRCodeModal',
    fallback: en,
  })
  const {extension} = props
  const {state} = useDevConsoleInternal()

  const showToast = useToast()

  const mobileQRCode = useMemo(() => {
    if (!state.app || !extension) {
      return undefined
    }

    if (extension.surface === 'pos') {
      return `com.shopify.pos://pos-ui-extensions?url=${extension.development.root.url}`
    } else {
      return `https://${state.store}/admin/extensions-dev/mobile?url=${extension.development.root.url}`
    }
  }, [extension, state.app, state.store])

  const onButtonClick = useCallback(() => {
    if (mobileQRCode && copyToClipboard(mobileQRCode)) {
      showToast({
        content: i18n.translate('qrcode.copied'),
      })
    }
  }, [mobileQRCode, showToast, i18n])

  // We should be checking for development with the code below
  // const isDevelopment = Boolean(import.meta.env.VITE_WEBSOCKET_HOST);
  // Unfortunately, ts-jest is throwing errors. See issue for more details.
  // https://github.com/kulshekhar/ts-jest/issues/1174
  const isDevelopment = false

  if (!extension) {
    return null
  }

  if (!isDevelopment && extension.development.root.url.includes('localhost')) {
    return (
      <div className={styles.PopoverContent}>
        <Stack alignment="center" vertical>
          <Icon source={CircleAlertMajor} color="subdued" />
          <p>{i18n.translate('qrcode.useSecureURL')}</p>
        </Stack>
      </div>
    )
  }

  if (mobileQRCode) {
    return (
      <div className={styles.Wrapper}>
        <div className={styles.CopyLink}>
          <Button icon={DuplicateMinor} plain monochrome onClick={onButtonClick}>
            {i18n.translate('qrcode.copy')}
          </Button>
        </div>
        <QRCode value={mobileQRCode} />
        <div className={styles.PopoverContent}>
          <p>
            {i18n.translate('qrcode.content', {
              thisExtension: <b>{i18n.translate('qrcode.thisExtension')}</b>,
            })}
          </p>
        </div>
      </div>
    )
  }

  return null
}
