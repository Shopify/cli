import en from './translations/en.json'
import * as styles from './ActionSet.module.scss'

import React, {useCallback} from 'react'
import {ExternalMinor, LinkMinor, MobileMajor, RefreshMinor} from '@shopify/polaris-icons'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {Action} from '@/components/Action'
import {useExtensionsInternal} from '@/sections/Extensions/hooks/useExtensionsInternal'

export interface ActionSetProps {
  className?: string
  selected?: boolean
  extension: ExtensionPayload
  onCloseMobileQRCode?: () => void
  onShowMobileQRCode?: (extension: ExtensionPayload) => void
}

export function ActionSet(props: ActionSetProps) {
  const [i18n] = useI18n({
    id: 'ActionSet',
    fallback: en,
  })
  const {extension, className, onShowMobileQRCode} = props
  const {embedded, navigate, refresh} = useExtensionsInternal()
  const hideWebUrl = extension.surface === 'pos'

  const handleOpenRoot = useCallback(() => {
    const roolUrl = extension.development.root.url
    if (embedded && window.top) {
      navigate(extension)
      return
    }
    window.open(roolUrl, '_blank')
  }, [embedded, extension, navigate])

  const refreshExtension = useCallback(() => refresh([extension]), [extension, refresh])

  // If the dev console is embedded then links should be opened in the current top window
  const LinkIcon = embedded ? LinkMinor : ExternalMinor

  return (
    <>
      <td>
        <div className={styles.ActionGroup}>
          {!hideWebUrl && (
            <Action
              source={LinkIcon}
              accessibilityLabel={i18n.translate('openRootUrl')}
              onAction={handleOpenRoot}
              className={className}
            />
          )}
          {onShowMobileQRCode && (
            <Action
              source={MobileMajor}
              accessibilityLabel={i18n.translate('qrcode')}
              onAction={() => onShowMobileQRCode(extension)}
              className={className}
            />
          )}
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
