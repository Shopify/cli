import en from './translations/en.json'

import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {HideIcon, ViewIcon} from '@shopify/polaris-icons'
import {Button} from '@/components/Button'

interface Props {
  hidden: boolean
  show(): void
  hide(): void
}

export function View({show, hide, hidden}: Props) {
  const [i18n] = useI18n({
    id: 'View',
    fallback: en,
  })

  return hidden ? (
    <Button type="button" onClick={show} icon={{source: HideIcon, position: 'left'}}>
      {i18n.translate('hidden')}
    </Button>
  ) : (
    <Button type="button" onClick={hide} icon={{source: ViewIcon, position: 'left'}}>
      {i18n.translate('showing')}
    </Button>
  )
}
