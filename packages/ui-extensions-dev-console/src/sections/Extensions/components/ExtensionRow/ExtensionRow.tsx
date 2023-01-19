import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'

import {PreviewLinks} from './components'
import {QRCodeModal, Row, Status, View} from '..'
import {useExtension} from '../../hooks/useExtension'
import React, {useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'

interface Props {
  uuid: ExtensionPayload['uuid']
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
        <span className={styles.Title}>{extension.title}</span>
      </td>
      <td>
        <PreviewLinks extension={extension} />
      </td>
      <td>
        <Button type="button" onClick={() => setShowModal(true)}>
          {i18n.translate('viewMobile')}
        </Button>
        <QRCodeModal
          code={
            showModal
              ? {
                  url: extension.development.root.url,
                  type: extension.surface,
                  title: extension.title,
                }
              : undefined
          }
          onClose={() => setShowModal(false)}
        />
      </td>
      <td>
        <View show={show} hide={hide} hidden={extension.development.hidden} />
      </td>
      <td>
        <Status status={extension.development.status} />
      </td>
    </Row>
  )
}
