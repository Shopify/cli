import * as styles from './Layout.module.scss'
import en from './translations/en.json'
import React, {useState} from 'react'
import '@shopify/polaris/dist/styles.css'
import {HideMinor, ToolsMajor, ViewMinor} from '@shopify/polaris-icons'
import {useI18n} from '@shopify/react-i18n'
import {ToastProvider} from '@/hooks/useToast'
import {Action} from '@/components/Action'
import {useExtensionsInternal} from '@/sections/Extensions/hooks/useExtensionsInternal'

interface Props {
  children: React.ReactNode
}

function Layout({children}: Props) {
  const [i18n] = useI18n({
    id: 'Layout',
    fallback: en,
  })

  const {
    show,
    hide,
    state: {extensions},
  } = useExtensionsInternal()
  const [showExtensions, setShowExtensions] = useState(true)

  function handleToggleExtensions() {
    if (showExtensions) {
      hide(extensions)
      setShowExtensions(false)
    } else {
      show(extensions)
      setShowExtensions(true)
    }
  }

  return (
    <ToastProvider>
      <div className={styles.OuterContainer}>
        <div className={styles.DevTool}>
          <header className={styles.Header}>
            <ToolsMajor />
            <h1>&nbsp;{i18n.translate('title')}</h1>
            <div className={styles.Actions}>
              <Action
                source={showExtensions ? ViewMinor : HideMinor}
                accessibilityLabel={
                  showExtensions ? i18n.translate('extensions.hide') : i18n.translate('extensions.show')
                }
                onAction={handleToggleExtensions}
              />
            </div>
          </header>
          <main>{children}</main>
        </div>
      </div>
    </ToastProvider>
  )
}

export default Layout
