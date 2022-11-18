import * as styles from './Layout.module.scss'
import en from './translations/en.json'
import React from 'react'
import '@shopify/polaris/dist/styles.css'
import {ChevronRightMinor, ToolsMajor} from '@shopify/polaris-icons'
import {useI18n} from '@shopify/react-i18n'
import {Link} from 'react-router-dom'
import {ToastProvider} from '@/hooks/useToast'

interface Props {
  children: React.ReactNode
}

function Layout({children}: Props) {
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
                  <li>
                    <Link className={styles.MenuItem} to="/">
                      {i18n.translate('nav.home')}
                      <ChevronRightMinor />
                    </Link>
                  </li>
                  <li>
                    <Link className={styles.MenuItem} to="/extensions">
                      {i18n.translate('nav.extensions')}
                      <ChevronRightMinor />
                    </Link>
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
