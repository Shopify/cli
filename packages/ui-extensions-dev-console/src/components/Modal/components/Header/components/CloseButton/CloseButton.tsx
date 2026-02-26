import en from './translations/en.json'
import {IconButton} from '@/components/IconButton/IconButton'
import React from 'react'
import {XIcon} from '@shopify/polaris-icons'
import {useI18n} from '@shopify/react-i18n'

interface CloseButtonProps {
  pressed?: boolean
  onClick(): void
}

export function CloseButton({pressed, onClick}: CloseButtonProps) {
  const [i18n] = useI18n({
    id: 'ModalCloseButton',
    fallback: en,
  })

  return (
    <IconButton
      source={XIcon}
      type="button"
      onClick={onClick}
      selected={pressed}
      accessibilityLabel={i18n.translate('close')}
    />
  )
}
