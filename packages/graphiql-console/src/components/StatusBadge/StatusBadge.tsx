import * as styles from './StatusBadge.module.scss'
import React from 'react'
import {Badge} from '@shopify/polaris'
import {AlertCircleIcon, DisabledIcon} from '@shopify/polaris-icons'
import type {ServerStatus} from '@/hooks/useServerStatus'

interface StatusBadgeProps {
  status: ServerStatus
}

/**
 * Displays current server and app status
 * Replaces 3 pre-rendered badges toggled via CSS in current implementation
 */
export function StatusBadge({status}: StatusBadgeProps) {
  const {serverIsLive, appIsInstalled} = status

  // Priority: disconnected > unauthorized > running
  if (!serverIsLive) {
    return (
      <div className={styles.Badge}>
        <Badge tone="critical" icon={DisabledIcon}>
          Disconnected
        </Badge>
      </div>
    )
  }

  if (!appIsInstalled) {
    return (
      <div className={styles.Badge}>
        <Badge tone="attention" icon={AlertCircleIcon}>
          App uninstalled
        </Badge>
      </div>
    )
  }

  return (
    <Badge tone="success" progress="complete">
      Running
    </Badge>
  )
}
