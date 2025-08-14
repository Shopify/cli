import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'

import {PreviewLinks} from './components'
import {QRCodeModal, Row, Status} from '..'
import {useExtension} from '../../hooks/useExtension'
import React, {useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload, ExtensionPoint, isUIExtension} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'

interface Props {
  uuid: ExtensionPayload['uuid']
}

function isUnifiedPOSUIExtension(extension: ExtensionPayload): boolean {
  return (extension.extensionPoints as ExtensionPoint[])?.some((point) => {
    return point.surface === 'point_of_sale'
  })
}

function showMobileQrCode(extension: ExtensionPayload) {
  if (isUIExtension(extension)) {
    // We currently only support POS UI Extensions for mobile. We don't have support for Admin yet.
    return isUnifiedPOSUIExtension(extension)
  }

  return extension.surface === 'point_of_sale' || extension.surface === 'admin'
}

function getPOSExtensionTarget(extension: ExtensionPayload): string | undefined {
  // For unified POS UI extensions, get the target from the first POS extension point
  if (isUIExtension(extension) && Array.isArray(extension.extensionPoints)) {
    const posExtensionPoint = (extension.extensionPoints as ExtensionPoint[]).find(
      (point) => point.surface === 'point_of_sale'
    )
    return posExtensionPoint?.target
  }

  return undefined
}

export function ExtensionRow({uuid}: Props) {
  const [showModal, setShowModal] = useState(false)
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  })

  const {focus, unfocus, extension} = useExtension(uuid)

  if (!extension) {
    return null
  }

  // Get the target for POS extensions to enable deeplinking
  const posTarget = getPOSExtensionTarget(extension)

  return (
    <Row onMouseEnter={focus} onMouseLeave={unfocus}>
      <td>
        <span className={styles.Title}>{extension.handle}</span>
      </td>
      <td>
        <PreviewLinks extension={extension} isUnifiedPOSUI={isUnifiedPOSUIExtension(extension)} />
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
                  type: isUnifiedPOSUIExtension(extension) ? 'point_of_sale' : extension.surface,
                  title: extension.handle,
                  target: posTarget, // Pass the target for deeplinking
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
