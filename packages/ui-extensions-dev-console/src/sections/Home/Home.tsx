import en from './translations/en.json'
import {useI18n} from '@shopify/react-i18n'
import React from 'react'

// Hiding content until there are more options in the side nav
const DISPLAY_SIDENAV = false

export function Home() {
  const [i18n] = useI18n({
    id: 'Home',
    fallback: en,
  })
  return <div>HI</div>
}
