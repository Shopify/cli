import * as styles from './PreviewLinks.module.scss'
import en from './translations/en.json'
import {NotApplicable, PreviewLink} from '../../..'
import React from 'react'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {useI18n} from '@shopify/react-i18n'
import {classNames} from '@/utilities/css'

export interface Props {
  extension: ExtensionPayload
}

export function PreviewLinks({extension}: Props) {
  const [i18n] = useI18n({
    id: 'PreviewLinks',
    fallback: en,
  })

  if (extension.surface === 'pos') {
    return <NotApplicable />
  }

  if (extension.type === 'ui_extension') {
    const hasMultiple = extension.extensionPoints && extension.extensionPoints.length > 1
    const titleMarkup = hasMultiple ? (
      <span className={styles.PreviewLinksTitle}>{i18n.translate('previewLinksTitle')}:</span>
    ) : null

    return (
      <>
        {titleMarkup}
        <span className={classNames(hasMultiple && styles.PreviewLinks)}>
          {extension.extensionPoints?.map((extensionPoint) => {
            if (typeof extensionPoint === 'string') {
              return null
            }

            const {root, target} = extensionPoint

            return <PreviewLink url={root.url} title={target} key={target} />
          })}
        </span>
      </>
    )
  }

  return <PreviewLink url={extension.development.root.url} title={extension.type.replaceAll('_', ' ')} />
}
