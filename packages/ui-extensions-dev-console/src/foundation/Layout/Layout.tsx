import * as styles from './Layout.module.scss'
import en from './translations/en.json'
import React from 'react'
import {WrenchIcon} from '@shopify/polaris-icons'
import {useI18n} from '@shopify/react-i18n'

interface Props {
  children: React.ReactNode
}

export function Layout({children}: Props) {
  const [i18n] = useI18n({
    id: 'Layout',
    fallback: en,
  })

  return (
    <div className={styles.OuterContainer}>
      <div className={styles.DevTool}>
        <header className={styles.Header}>
          <section className={styles.HeaderContent}>
            <WrenchIcon />
            <h1>&nbsp;{i18n.translate('title')}</h1>
          </section>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}
