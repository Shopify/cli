import {Logs} from './ui/components/Logs.js'
import {PollOptions, SubscribeOptions} from '../types.js'
import {subscribeToAppLogs} from '../utils.js'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'

export async function renderLogs({
  pollOptions,
  options: {variables, developerPlatformClient},
  storeNameById,
}: {
  pollOptions: PollOptions
  options: SubscribeOptions
  storeNameById: Map<string, string>
}) {
  const resubscribeCallback = async () => {
    return subscribeToAppLogs(developerPlatformClient, variables)
  }

  return render(
    <Logs
      pollOptions={pollOptions}
      resubscribeCallback={resubscribeCallback}
      storeNameById={storeNameById}
      developerPlatformClient={developerPlatformClient}
    />,
  )
}
