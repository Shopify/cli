import * as styles from './AppHomeRow.module.scss'
import en from './translations/en.json'

import {NotApplicable, PreviewLink, QRCodeModal, Row} from '..'
import {useApp} from '../../hooks/useApp'
import {useExtensionServerOptions} from '../../hooks/useExtensionServerOptions.js'
import {useI18n} from '@shopify/react-i18n'
import React, {useState} from 'react'
import {Button} from '@/components'

export function AppHomeRow() {
  const [showModal, setShowModal] = useState(false)
  const [i18n] = useI18n({
    id: 'AppHomeRow',
    fallback: en,
  })

  const {surface} = useExtensionServerOptions()
  const {app} = useApp()

  if (!app) {
    return null
  }

  const resourceUrl = surface === 'admin' && app.handle ? `/admin/apps/${app.handle}` : undefined

  return (
    <Row>
      <td>
        <span className={styles.Title}>{app.title}</span>
      </td>
      <td>
        <PreviewLink resourceUrl={resourceUrl} rootUrl={app.url} title={'App home'} />
      </td>
      <td>
        <Button type="button" onClick={() => setShowModal(true)}>
          {i18n.translate('viewMobile')}
        </Button>
        <QRCodeModal
          code={
            showModal
              ? {
                  url: app.url,
                  type: 'home',
                  title: app.title,
                }
              : undefined
          }
          onClose={() => setShowModal(false)}
        />
      </td>
      <td>
        <NotApplicable />
      </td>
    </Row>
  )
}
