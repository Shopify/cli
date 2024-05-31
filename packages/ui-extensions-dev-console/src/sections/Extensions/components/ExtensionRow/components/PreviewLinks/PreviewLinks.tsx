import * as styles from './PreviewLinks.module.scss'
import en from './translations/en.json'
import {NotApplicable, PreviewLink} from '../../..'
import React from 'react'
import {ExtensionPayload} from '@shopify/ui-extensions-server-kit'
import {useI18n} from '@shopify/react-i18n'
import {classNames} from '@/utilities/css'

interface Props {
  extension: ExtensionPayload
}

export function PreviewLinks({extension}: Props) {
  const [i18n] = useI18n({
    id: 'PreviewLinks',
    fallback: en,
  })

  if (extension.surface === 'point_of_sale') {
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

            const {root, target, resource} = extensionPoint

            return <PreviewLink rootUrl={root.url} title={target} key={target} resourceUrl={resource.url} />
          })}
        </span>
      </>
    )
  }

  return (
    <PreviewLink
      rootUrl={extension.development.root.url}
      resourceUrl={extension.development.resource.url}
      title={extension.type.replaceAll('_', ' ')}
    />
  )
}
