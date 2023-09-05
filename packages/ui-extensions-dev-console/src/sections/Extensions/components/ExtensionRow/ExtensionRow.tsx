import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'

import {PreviewLinks} from './components'
import {QRCodeModal, Row, Status} from '..'
import {useExtension} from '../../hooks/useExtension'
import React, {useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload, isUIExtension} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'

interface Props {
  uuid: ExtensionPayload['uuid']
}

function showMobileQrCode(extension: ExtensionPayload) {
  if (isUIExtension(extension)) {
    // We currently don't have support for any of the new UI extensions on Mobile
    return false
  }

  return extension.surface === 'point_of_sale' || extension.surface === 'admin'
}

export function ExtensionRow({uuid}: Props) {
  const [showModal, setShowModal] = useState(false)
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  })

  const {focus, unfocus, extension, show, hide} = useExtension(uuid)

  if (!extension) {
    return null
  }

  return (
    <Row onMouseEnter={focus} onMouseLeave={unfocus}>
      <td>
        <span className={styles.Title}>{extension.handle}</span>
      </td>
      <td>
        <PreviewLinks extension={extension} />
      </td>
      <td>
        {showMobileQrCode(extension) && (
          <Button id="showQRCodeModalButton" type="button" onClick={() => setShowModal(true)}>
            {i18n.translate('viewMobile')}
          </Button>
        )}
        <QRCodeModal
          code={
            showModal
              ? {
                  url: extension.development.root.url,
                  type: extension.surface,
                  title: extension.handle,
                }
              : undefined
          }
          onClose={() => setShowModal(false)}
        />
      </td>
      <td>
        <Status status={extension.development.status} />
      </td>
    </Row>
  )
}
