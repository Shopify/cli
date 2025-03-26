import * as styles from './Extensions.module.scss'

import {ExtensionRow, AppHomeRow, Row} from './components'
import en from './translations/en.json'
import {useExtensions} from './hooks/useExtensions'
import {useExtensionServerOptions} from './hooks/useExtensionServerOptions'
import {useApp} from './hooks/useApp'
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
  const {app} = useApp()

  if (!extensionIds.length) {
    return (
      <div className={styles.Empty}>
        {surface ? i18n.translate('errors.noExtensionsForSurface', {surface}) : i18n.translate('errors.noExtensions')}
      </div>
    )
  }

  const introMessage = i18n.translate('intro', {
    installLink: (
      <a href={app?.url} target={'_blank'} aria-label={i18n.translate('introInstallCta')}>
        {i18n.translate('introInstallCta')}
      </a>
    ),
  })

  return (
    <section className={styles.ExtensionList}>
      {isEmbedded ? null : <p className={styles.Intro}>{introMessage}</p>}
      <table>
        <thead>
          <Row>
            <th>{i18n.translate('extensionList.handle')}</th>
            <th>{i18n.translate('extensionList.preview')}</th>
            <th>{i18n.translate('extensionList.mobile')}</th>
            <th>{i18n.translate('extensionList.status')}</th>
          </Row>
        </thead>
        <tbody>
          <AppHomeRow />
          {extensionIds.map(({uuid}) => {
            return <ExtensionRow key={uuid} uuid={uuid} />
          })}
        </tbody>
      </table>
    </section>
  )
}
