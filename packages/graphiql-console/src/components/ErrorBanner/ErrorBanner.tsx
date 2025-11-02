import React from 'react'
import {Banner} from '@shopify/polaris'
import {DisabledIcon} from '@shopify/polaris-icons'

interface ErrorBannerProps {
  isVisible: boolean
}

/**
 * Shows critical error when server disconnects
 * Replaces manual display toggling in current implementation
 */
export function ErrorBanner({isVisible}: ErrorBannerProps) {
  if (!isVisible) return null

  return (
    <Banner tone="critical" icon={DisabledIcon}>
      <p>
        The server has been stopped. Restart <code>dev</code> from the CLI.
      </p>
    </Banner>
  )
}
