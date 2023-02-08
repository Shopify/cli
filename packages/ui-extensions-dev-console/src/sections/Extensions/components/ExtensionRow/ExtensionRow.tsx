import * as styles from './ExtensionRow.module.scss'
import en from './translations/en.json'

import {PreviewLinks, SettingsModal} from './components'
import {QRCodeModal, Row, Status, View} from '..'
import {useExtension} from '../../hooks/useExtension'
import React, {useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {toast} from 'react-toastify'
import {Button} from '@/components/Button'

interface Props {
  uuid: ExtensionPayload['uuid']
}

type ModalType = 'settings' | 'qr'

export function ExtensionRow({uuid}: Props) {
  const [modalToShow, setModalToShow] = useState<ModalType | null>(null)
  const [i18n] = useI18n({
    id: 'ExtensionRow',
    fallback: en,
  })

  const {focus, unfocus, extension, show, hide, setSettings} = useExtension(uuid)

  if (!extension) {
    return null
  }

  const onModalClose = () => {
    setModalToShow(null)
    toast('Extension placement saved', {toastId: 'extension-placement-success'})
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
        <Button type="button" onClick={() => setModalToShow('qr')}>
          {i18n.translate('viewMobile')}
        </Button>
        <QRCodeModal
          code={
            modalToShow === 'qr'
              ? {
                  url: extension.development.root.url,
                  type: extension.surface,
                  title: extension.title,
                }
              : undefined
          }
          onClose={() => setModalToShow(null)}
        />
      </td>
      <td>
        <View show={show} hide={hide} hidden={extension.development.hidden} />
      </td>
      <td>
        <Status status={extension.development.status} />
      </td>
      <td>
        {extension.type === 'checkout_ui_extension' && (
          <>
            <Button type="button" onClick={() => setModalToShow('settings')}>
              Settings
            </Button>

            <SettingsModal
              open={modalToShow === 'settings'}
              onClose={onModalClose}
              setSettings={setSettings}
              settings={{placementReference: extension.development.placementReference}}
            />
          </>
        )}
      </td>
    </Row>
  )
}
