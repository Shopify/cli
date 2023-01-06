import en from './translations/en.json'
import * as styles from './PostPurchaseModal.module.scss'
import React from 'react'
import {Modal, ModalProps} from '@shopify/polaris'
import {useI18n} from '@shopify/react-i18n'
import {ClipboardMinor} from '@shopify/polaris-icons'
import {toast} from 'react-toastify'
import {IconButton} from '@/components/IconButton'

interface Props extends Pick<ModalProps, 'onClose'> {
  url?: string
}

export function PostPurchaseModal({url, onClose}: Props) {
  const [i18n] = useI18n({
    id: 'PostPurchaseModal',
    fallback: en,
  })

  function handleCopyPreviewLink() {
    if (!url) {
      return
    }

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
    <Modal title={i18n.translate('title')} open={typeof url === 'string'} onClose={onClose}>
      <div className={styles.Content}>
        <ol className={styles.Instructions}>
          <li>
            {i18n.translate('point1.intro')}{' '}
            <a href="" target="_blank">
              {i18n.translate('point1.linkText')}
            </a>
          </li>
          <li>
            {i18n.translate('point2')}
            <span className={styles.UrlContainer}>
              <span className={styles.Url}>{url}</span>{' '}
              <span className={styles.CopyButton}>
                <IconButton
                  type="button"
                  onClick={() => handleCopyPreviewLink()}
                  source={ClipboardMinor}
                  accessibilityLabel={i18n.translate('copy.label')}
                />
              </span>
            </span>
          </li>
          <li>{i18n.translate('point3')}</li>
        </ol>
      </div>
    </Modal>
  )
}
