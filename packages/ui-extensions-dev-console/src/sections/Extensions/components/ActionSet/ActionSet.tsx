import en from './translations/en.json'
import * as styles from './ActionSet.module.scss'

import React, {useCallback} from 'react'
import {RefreshMinor} from '@shopify/polaris-icons'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Action} from '@/components/Action'
import {useExtensionsInternal} from '@/sections/Extensions/hooks/useExtensionsInternal'

export interface ActionSetProps {
  className?: string
  extension: ExtensionPayload
}

export function ActionSet({extension, className}: ActionSetProps) {
  const [i18n] = useI18n({
    id: 'ActionSet',
    fallback: en,
  })
  const {refresh} = useExtensionsInternal()
  const refreshExtension = useCallback(() => refresh([extension]), [extension, refresh])

  return (
    <>
      <td>
        <div className={styles.ActionGroup}>
          <Action
            source={RefreshMinor}
            accessibilityLabel={i18n.translate('refresh')}
            onAction={refreshExtension}
            className={className}
          />
        </div>
      </td>
    </>
  )
}
