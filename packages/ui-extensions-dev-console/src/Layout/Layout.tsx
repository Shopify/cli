import * as styles from './Layout.module.scss'
import en from './translations/en.json'
import React from 'react'
import '@shopify/polaris/dist/styles.css'
import {ToolsMajor} from '@shopify/polaris-icons'
import {useI18n} from '@shopify/react-i18n'

interface Props {
  children: React.ReactNode
}

function Layout({children}: Props) {
  const [i18n] = useI18n({
    id: 'Layout',
    fallback: en,
  })

  return (
    <div className={styles.OuterContainer}>
      <div className={styles.DevTool}>
        <header className={styles.Header}>
          <section className={styles.HeaderLeft}>
            <ToolsMajor />
            <h1>&nbsp;{i18n.translate('title')}</h1>
          </section>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}

export default Layout
