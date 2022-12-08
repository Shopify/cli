import * as styles from './AppRow.module.scss'
import en from './translations/en.json'
import {useExtensionsInternal} from '../../hooks/useExtensionsInternal.js'
import React, {useMemo, useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {MobileMajor} from '@shopify/polaris-icons'
import {Link, Modal} from '@shopify/polaris'
import QRCode from 'qrcode.react'
import {Action} from '@/components/Action'

export interface ExtensionRowProps {
  url: string
  title: string
}

export function AppRow({url, title}: ExtensionRowProps) {
  const [showModel, setShowModal] = useState(false)
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  })
  const {
    state: {store},
  } = useExtensionsInternal()

  // TODO: This is the URL for an extension
  // Is there an equivelant URL for an app home page?
  const qrCodeUrl = useMemo(() => `https://${store}/admin/extensions-dev/mobile?url=${url}`, [store, url])

  console.log(qrCodeUrl)

  return (
    <>
      <tr className={styles.DevToolRow}>
        <td></td>
        <td>
          <Link url={url} external>
            {title}
          </Link>
        </td>
        <td></td>
        <td></td>
        <td>
          <div className={styles.ActionSet}>
            <Action
              source={MobileMajor}
              accessibilityLabel={i18n.translate('qrcode.label')}
              onAction={() => setShowModal(true)}
            />
          </div>
        </td>
      </tr>
      <Modal
        title={i18n.translate('qrcode.title')}
        titleHidden
        open={showModel}
        onClose={() => setShowModal(false)}
        sectioned
        small
        noScroll
      >
        <QRCode value={qrCodeUrl} />
      </Modal>
    </>
  )
}
