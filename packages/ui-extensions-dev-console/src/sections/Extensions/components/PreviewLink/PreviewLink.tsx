import * as styles from './PreviewLink.module.scss'
import en from './translations/en.json'
import {ActionSetProps} from '../ActionSet'
import {useExtensionsInternal} from '../../hooks/useExtensionsInternal.js'
import React, {useCallback} from 'react'
import {useI18n} from '@shopify/react-i18n'
import {Link} from '@shopify/polaris'
import {ClipboardMinor} from '@shopify/polaris-icons'
import {Action} from '@/components/Action/Action'
import {useToast} from '@/hooks/useToast'

export type Props = {
  url: string
  title: string
} & Pick<ActionSetProps, 'onShowMobileQRCode' | 'onCloseMobileQRCode'>

export function PreviewLink({url, title}: Props) {
  const [i18n] = useI18n({
    id: 'PreviewLink',
    fallback: en,
  })
  const showToast = useToast()
  const {embedded, navigate} = useExtensionsInternal()

  const handleOpenUrl = useCallback(() => {
    if (embedded && window.top) {
      navigate(url)
      return
    }
    window.open(url, '_blank')
  }, [embedded, url, navigate])

  function handleCopy() {
    if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(url)
        .then(() =>
          showToast({
            content: i18n.translate('copy.toast'),
          }),
        )
        .catch(() =>
          showToast({
            content: i18n.translate('copy.error'),
          }),
        )
    }
  }

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <span className={styles.UrlWrapper} onClick={(event) => event.preventDefault()}>
      <Link url={url} external onClick={handleOpenUrl}>
        {title}
      </Link>
      <Action source={ClipboardMinor} accessibilityLabel={i18n.translate('copy.label')} onAction={() => handleCopy()} />
    </span>
  )
}
