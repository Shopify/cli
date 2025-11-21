import React from 'react'
import {Select} from '@shopify/polaris'

interface ApiVersionSelectorProps {
  // Available API versions
  versions: string[]
  // Currently selected version
  value: string
  // Callback when version changes
  onChange: (version: string) => void
}

/**
 * API version selector component
 * Replaces vanilla JS event listener and manual DOM manipulation
 */
export function ApiVersionSelector({versions, value, onChange}: ApiVersionSelectorProps) {
  return (
    <Select
      label="API version"
      labelHidden
      options={versions.map((version) => ({label: version, value: version}))}
      value={value}
      onChange={onChange}
    />
  )
}
