import * as styles from './Extensions.module.scss'

import {AppHomeRow, QRCodeModal, ExtensionRow, PostPurchaseRow, PostPurchaseModal} from './components'
import en from './translations/en.json'
import {useI18n} from '@shopify/react-i18n'
import React, {useState} from 'react'
import {ExtensionPayload, Surface} from '@shopify/ui-extensions-server-kit'
import {useExtensionsInternal} from '@/sections/Extensions/hooks/useExtensionsInternal'

export function Extensions() {
  const [i18n] = useI18n({
    id: 'Extensions',
    fallback: en,
  })

  const {
    state: {extensions, app},
    focus,
    unfocus,
    client: {
      options: {surface},
    },
  } = useExtensionsInternal()

  const [activeMobileQRCode, setActiveMobileQRCode] = useState<
    | {
        url: string
        type: Surface | 'home'
        title: string
      }
    | undefined
  >(undefined)
  const [postPurchaseUrl, setPostPurchaseUrl] = useState<string | undefined>(undefined)

  const ConsoleContent = () => (
    <section className={styles.ExtensionList}>
      <p className={styles.Intro}>{i18n.translate('intro')}</p>
      <table>
        <thead>
          <tr>
            <th>{i18n.translate('extensionList.name')}</th>
            <th>{i18n.translate('extensionList.preview')}</th>
            <th>{i18n.translate('extensionList.mobile')}</th>
            <th>{i18n.translate('extensionList.view')}</th>
            <th>{i18n.translate('extensionList.status')}</th>
          </tr>
        </thead>
        <tbody>
          {app ? (
            <AppHomeRow
              url={app.url}
              title={app.title}
              onShowMobileQRCode={() => {
                setActiveMobileQRCode({
                  url: app.url,
                  type: 'home',
                  title: app.title,
                })
              }}
            />
          ) : null}
          {extensions.map((extension) => {
            if (extension.type === 'checkout_post_purchase') {
              return (
                <PostPurchaseRow
                  key={extension.uuid}
                  extension={extension}
                  onHighlight={focus}
                  onClearHighlight={unfocus}
                  onOpenPostPurchaseModal={() => setPostPurchaseUrl(extension.development.root.url)}
                />
              )
            }

            return (
              <ExtensionRow
                key={extension.uuid}
                extension={extension}
                onHighlight={focus}
                onClearHighlight={unfocus}
                onShowMobileQRCode={(extension: ExtensionPayload) =>
                  setActiveMobileQRCode({
                    url: extension.development.root.url,
                    type: extension.surface,
                    title: extension.title,
                  })
                }
              />
            )
          })}
        </tbody>
      </table>
    </section>
  )

  const ConsoleEmpty = () => {
    return (
      <div className={styles.Empty}>
        {surface ? i18n.translate('errors.noExtensionsForSurface', {surface}) : i18n.translate('errors.noExtensions')}
      </div>
    )
  }

  return (
    <>
      {extensions.length > 0 ? <ConsoleContent /> : <ConsoleEmpty />}
      <QRCodeModal code={activeMobileQRCode} onClose={() => setActiveMobileQRCode(undefined)} />
      <PostPurchaseModal onClose={() => setPostPurchaseUrl(undefined)} url={postPurchaseUrl} />
    </>
  )
}
