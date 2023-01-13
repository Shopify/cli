import en from './translations/en.json'

import {useExtensionsInternal} from '../../hooks/useExtensionsInternal'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {ViewMinor} from '@shopify/polaris-icons'
import {Button} from '@/components'

interface Props {
  extension: ExtensionPayload
}

export function View({extension}: Props) {
  const [i18n] = useI18n({
    id: 'View',
    fallback: en,
  })

  const {show, hide} = useExtensionsInternal()

  return extension.development.hidden ? (
    <Button type="button" onClick={() => show([extension])} icon={{source: ViewMinor, position: 'left'}}>
      {i18n.translate('live')}
    </Button>
  ) : (
    <Button type="button" onClick={() => hide([extension])} icon={{source: ViewMinor, position: 'left'}}>
      {i18n.translate('local')}
    </Button>
  )
}
