import * as styles from './PreviewLinks.module.scss'
import en from './translations/en.json'
import {useExtensionsInternal} from '../../../../hooks/useExtensionsInternal.js'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {ClipboardMinor} from '@shopify/polaris-icons'
import {toast} from 'react-toastify'
import {IconButton} from '@/components/IconButton'

export interface Props {
  extension: ExtensionPayload
}

export function PreviewLinks({extension}: Props) {
  if (extension.surface === 'pos') {
    return <span className={styles.NotApplicable}>--</span>
  }

  if (extension.type === 'ui_extension') {
    return (
      <>
        <span className={styles.PreviewLinksTitle}>Multiple locations:</span>
        <span className={styles.PreviewLinks}>
          {extension.extensionPoints?.map((extensionPoint) => {
            if (typeof extensionPoint === 'string') {
              return null
            }

            const {root, target} = extensionPoint

            return <PreviewLink url={root.url} title={target} />
          })}
        </span>
      </>
    )
  }

  return <PreviewLink url={extension.development.root.url} title={extension.type.replaceAll('_', ' ')} />
}

function PreviewLink({url, title}: {url: string; title: string}) {
  const [i18n] = useI18n({
    id: 'PreviewLinks',
    fallback: en,
  })

  const {embedded, navigate} = useExtensionsInternal()

  const handleOpenRoot = (event: React.MouseEvent<HTMLElement>) => {
    if (embedded && window.top) {
      navigate(url)
      event.preventDefault()
    }
  }

  function handleCopyPreviewLink() {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast(i18n.translate('copy.success'), {toastId: `copy-${url}`})
      })
      .catch(() => {
        toast(i18n.translate('copy.error'), {type: 'error', toastId: `copy-${url}-error`})
      })
  }

  return (
    <span className={styles.PreviewLink}>
      <a href={url} target="_blank" aria-label={i18n.translate('linkLabel', {title})} onClick={handleOpenRoot}>
        {title}
      </a>
      <IconButton
        type="button"
        onClick={() => handleCopyPreviewLink()}
        source={ClipboardMinor}
        accessibilityLabel={i18n.translate('iconLabel', {title})}
      />
    </span>
  )
}
