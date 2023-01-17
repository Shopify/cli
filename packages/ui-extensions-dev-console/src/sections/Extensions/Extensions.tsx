import * as styles from './Extensions.module.scss'

import {AppHomeRow, ExtensionRow, PostPurchaseRow, Row} from './components'
import en from './translations/en.json'
import {useExtensions} from './hooks/useExtensions'
import {useExtensionServerOptions} from './hooks/useExtensionServerOptions'
import {useI18n} from '@shopify/react-i18n'
import React from 'react'
import {isEmbedded} from '@/utilities/embedded'

export function Extensions() {
  const [i18n] = useI18n({
    id: 'Extensions',
    fallback: en,
  })

  const extensionIds = useExtensions()
  const {surface} = useExtensionServerOptions()

  if (!extensionIds.length) {
    return (
      <div className={styles.Empty}>
        {surface ? i18n.translate('errors.noExtensions') : i18n.translate('errors.noExtensionsForSurface', {surface})}
      </div>
    )
  }

  return (
    <section className={styles.ExtensionList}>
      {isEmbedded ? null : <p className={styles.Intro}>{i18n.translate('intro')}</p>}
      <table>
        <thead>
          <Row>
            <th>{i18n.translate('extensionList.name')}</th>
            <th>{i18n.translate('extensionList.preview')}</th>
            <th>{i18n.translate('extensionList.mobile')}</th>
            <th>{i18n.translate('extensionList.view')}</th>
            <th>{i18n.translate('extensionList.status')}</th>
          </Row>
        </thead>
        <tbody>
          <AppHomeRow />
          {extensionIds.map(({uuid, type}) => {
            if (type === 'checkout_post_purchase') {
              return <PostPurchaseRow key={uuid} uuid={uuid} />
            }

            return <ExtensionRow key={uuid} uuid={uuid} />
          })}
        </tbody>
      </table>
    </section>
  )
}
