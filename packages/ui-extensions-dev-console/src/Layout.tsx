import './theme.module.css'
import * as styles from './Layout.module.scss'
import en from './translations/en.json'
import React from 'react'
import '@shopify/polaris/dist/styles.css'
import {ToolsMajor, ChevronRightMinor} from '@shopify/polaris-icons'
import {useI18n} from '@shopify/react-i18n'
import {ToastProvider} from '@/hooks/useToast'

function Layout({children}) {
  const [i18n] = useI18n({
    id: 'Layout',
    fallback: en,
  })

  return (
    <ToastProvider>
      <div className={styles.OuterContainer}>
        <div className={styles.DevTool}>
          <header className={styles.Header}>
            <section className={styles.HeaderLeft}>
              <ToolsMajor />
              <h1>&nbsp;{i18n.translate('title')}</h1>
            </section>
          </header>
          <main>
            <aside className={styles.SideBar}>
              <nav>
                <ul>
                  <li className={styles.MenuItem}>
                    {i18n.translate('extensionList.title')}
                    <ChevronRightMinor />
                  </li>
                </ul>
              </nav>
            </aside>
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}

export default Layout
