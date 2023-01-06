import en from './translations/en.json'

import {useExtensionsInternal} from '../../hooks/useExtensionsInternal'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Button} from '@/components/Button'
import {ButtonGroup} from '@/components/ButtonGroup'

interface Props {
  extension: ExtensionPayload
}

export function View({extension}: Props) {
  const [i18n] = useI18n({
    id: 'View',
    fallback: en,
  })

  const {show, hide} = useExtensionsInternal()

  return (
    <ButtonGroup>
      <Button type="button" selected={!extension.development.hidden} onClick={() => show([extension])}>
        {i18n.translate('local')}
      </Button>
      <Button type="button" selected={extension.development.hidden} onClick={() => hide([extension])}>
        {i18n.translate('live')}
      </Button>
    </ButtonGroup>
  )
}
