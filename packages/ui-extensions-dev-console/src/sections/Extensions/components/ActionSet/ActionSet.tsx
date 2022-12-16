import en from './translations/en.json'
import * as styles from './ActionSet.module.scss'
// eslint-disable-next-line @shopify/strict-component-boundaries
import * as rowStyles from '../ExtensionRow/ExtensionRow.module.scss'
import React, {useCallback} from 'react'
import {HideMinor, RefreshMinor, ViewMinor} from '@shopify/polaris-icons'
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
  const {hide, refresh, show} = useExtensionsInternal()
  const hidden = extension.development.hidden

  const handleShowHide = useCallback(() => {
    if (hidden) {
      show([extension])
    } else {
      hide([extension])
    }
  }, [extension, hidden, hide, show])

  const refreshExtension = useCallback(() => refresh([extension]), [extension, refresh])

  return (
    <>
      <td>
        <div className={styles.ActionGroup}>
          <div className={`${hidden ? rowStyles.ForceVisible : ''}`}>
            <Action
              source={hidden ? HideMinor : ViewMinor}
              accessibilityLabel={hidden ? i18n.translate('show') : i18n.translate('hide')}
              onAction={handleShowHide}
              className={className}
            />
          </div>
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
