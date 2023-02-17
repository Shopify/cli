import en from './translations/en.json'

import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {HideMinor, ViewMinor} from '@shopify/polaris-icons'
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
    <Button type="button" onClick={show} icon={{source: HideMinor, position: 'left'}}>
      {i18n.translate('hidden')}
    </Button>
  ) : (
    <Button type="button" onClick={hide} icon={{source: ViewMinor, position: 'left'}}>
      {i18n.translate('showing')}
    </Button>
  )
}
