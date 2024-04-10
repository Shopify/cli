import * as styles from './PostPurchaseRow.module.scss'
import en from './translations/en.json'

import {PostPurchaseModal} from './components'
import {Row, Status} from '..'
import {useExtension} from '../../hooks/useExtension.js'
import React, {useState} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'

interface Props {
  uuid: ExtensionPayload['uuid']
}

export function PostPurchaseRow({uuid}: Props) {
  const [showModal, setShowModal] = useState(false)

  const [i18n] = useI18n({
    id: 'PostPurchaseRow',
    fallback: en,
  })

  const {focus, unfocus, extension} = useExtension(uuid)

  if (!extension) {
    return null
  }

  return (
    <Row onMouseEnter={focus} onMouseLeave={unfocus}>
      <td>
        <span className={styles.Title}>{extension.title}</span>
      </td>
      <td>
        <Button type="button" onClick={() => setShowModal(true)}>
          {i18n.translate('viewPreviewInstructions', {type: extension.type})}
        </Button>
        <PostPurchaseModal onClose={() => setShowModal(false)} url={extension.development.root.url} open={showModal} />
      </td>
      <td></td>
      <td>
        <Status status={extension.development.status} />
      </td>
    </Row>
  )
}
