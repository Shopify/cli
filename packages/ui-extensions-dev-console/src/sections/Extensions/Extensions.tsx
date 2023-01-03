import * as styles from './Extensions.module.scss'

// eslint-disable-next-line @shopify/strict-component-boundaries
import {QRCodeModal} from './components/QRCodeModal'
import en from './translations/en.json'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {useI18n} from '@shopify/react-i18n'
import React, {useState} from 'react'
import {ExtensionRow} from '@/sections/Extensions/components/ExtensionRow'
import {useExtensionsInternal} from '@/sections/Extensions/hooks/useExtensionsInternal'

export function Extensions() {
  const [i18n] = useI18n({
    id: 'Extensions',
    fallback: en,
  })

  const {
    state: {extensions},
    focus,
    unfocus,
    client: {
      options: {surface},
    },
  } = useExtensionsInternal()

  const [activeMobileQRCodeExtension, setActiveMobileQRCodeExtension] = useState<ExtensionPayload>()

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
          {extensions.map((extension) => {
            const uuid = extension.uuid
            return (
              <ExtensionRow
                key={uuid}
                extension={extension}
                onHighlight={focus}
                onClearHighlight={unfocus}
                onShowMobileQRCode={setActiveMobileQRCodeExtension}
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
      <QRCodeModal
        extension={activeMobileQRCodeExtension}
        open={activeMobileQRCodeExtension !== undefined}
        onClose={() => setActiveMobileQRCodeExtension(undefined)}
      />
    </>
  )
}
