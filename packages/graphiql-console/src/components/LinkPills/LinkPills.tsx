import * as styles from './LinkPills.module.scss'
import React from 'react'
import {Badge, Link} from '@shopify/polaris'
import {LinkIcon} from '@shopify/polaris-icons'
import type {ServerStatus} from '../types'

interface LinkPillsProps {
  status: ServerStatus
}

/**
 * Displays links to store admin and app preview
 * Replaces innerHTML replacement in current implementation
 */
export function LinkPills({status}: LinkPillsProps) {
  const {storeFqdn, appName, appUrl} = status

  if (!storeFqdn || !appName || !appUrl) {
    return null
  }

  return (
    <div className={styles.Container}>
      <Link url={`https://${storeFqdn}/admin`} target="_blank" removeUnderline>
        <Badge tone="info" icon={LinkIcon}>
          {storeFqdn}
        </Badge>
      </Link>
      <Link url={appUrl} target="_blank" removeUnderline>
        <Badge tone="info" icon={LinkIcon}>
          {appName}
        </Badge>
      </Link>
    </div>
  )
}
