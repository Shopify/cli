import en from './translations/en.json'

import * as styles from './SettingsModal.css'
import {ExtensionSettings} from '../../../../hooks/useExtension.js'
import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {CheckoutExtensionPlacementReference} from '@shopify/ui-extensions-server-kit'
import {Button, Modal, ModalProps} from '@/components/index'

interface Props extends Pick<ModalProps, 'onClose' | 'open'> {
  settings: ExtensionSettings
  setSettings: (settings: ExtensionSettings) => void
}

export function SettingsModal({setSettings, settings, onClose, open}: Props) {
  const [i18n] = useI18n({
    id: 'SettingsModal',
    fallback: en,
  })

  return (
    <Modal title={i18n.translate('title')} open={open} onClose={onClose} width="large">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setSettings({
            placementReference: (event.currentTarget.elements.namedItem('placementReference')! as HTMLSelectElement)
              .value as CheckoutExtensionPlacementReference,
          })
          onClose()
        }}
      >
        <div className={styles.SettingsWrapper}>
          <div>
            <label htmlFor="placementReference">Extension placement</label>
          </div>
          <div>
            <select name="placementReference" defaultValue={settings.placementReference}>
              {Object.values(CheckoutExtensionPlacementReference).map((placementReference) => {
                return (
                  <option key={placementReference} value={placementReference}>
                    {placementReference}
                  </option>
                )
              })}
            </select>
          </div>
        </div>
        <Button style={{marginTop: '8px'}} type="submit">
          Save
        </Button>
      </form>
    </Modal>
  )
}
