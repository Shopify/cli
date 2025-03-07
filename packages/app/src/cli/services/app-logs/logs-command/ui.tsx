import {Logs} from './ui/components/Logs.js'
import {PollOptions, SubscribeOptions} from '../types.js'
import {subscribeToAppLogs} from '../utils.js'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'
import {OrganizationSource} from '../../../models/organization.js'

export async function renderLogs({
  pollOptions,
  options: {variables, developerPlatformClient, organizationId},
  storeNameById,
  organizationSource,
  orgId,
  appId,
}: {
  pollOptions: PollOptions
  options: SubscribeOptions
  organizationSource: OrganizationSource
  orgId: string
  appId: string
  storeNameById: Map<string, string>
}) {
  const resubscribeCallback = async () => {
    return subscribeToAppLogs(developerPlatformClient, variables, organizationId)
  }

  return render(
    <Logs
      pollOptions={pollOptions}
      resubscribeCallback={resubscribeCallback}
      storeNameById={storeNameById}
      organizationSource={organizationSource}
      orgId={orgId}
      appId={appId}
    />,
  )
}
