import en from './translations/en.json'

import React from 'react'
import {useI18n} from '@shopify/react-i18n'
import {CheckoutExtensionPlacementReference} from '@shopify/ui-extensions-server-kit'
import {Button, Modal, ModalProps} from '@/components/index'
import {ExtensionSettings} from '@/sections/Extensions/hooks/useExtension.js'

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
        <div>
          <label htmlFor="placementReference">Placement reference</label>
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

        <Button type="submit">Submit</Button>
      </form>
    </Modal>
  )
}
