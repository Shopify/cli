import {BaseProcess, DevProcessFunction} from './types.js'
import {frontAndBackendConfig} from './utils.js'
import {sendUninstallWebhookToAppServer} from '../../webhook/send-app-uninstalled-webhook.js'
import {Web} from '../../../models/app/app.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'

interface SendWebhookOptions {
  deliveryPort: number
  developerPlatformClient: DeveloperPlatformClient
  storeFqdn: string
  apiSecret: string
  webhooksPath: string
}

export interface SendWebhookProcess extends BaseProcess<SendWebhookOptions> {
  type: 'send-webhook'
}

export const sendWebhook: DevProcessFunction<SendWebhookOptions> = async ({stdout}, options) => {
  await sendUninstallWebhookToAppServer({
    stdout,
    developerPlatformClient: options.developerPlatformClient,
    address: `http://localhost:${options.deliveryPort}${options.webhooksPath}`,
    sharedSecret: options.apiSecret,
    storeFqdn: options.storeFqdn,
  })
}

export function setupSendUninstallWebhookProcess({
  webs,
  remoteAppUpdated,
  backendPort,
  frontendPort,
  ...options
}: Pick<SendWebhookOptions, 'developerPlatformClient' | 'storeFqdn' | 'apiSecret'> & {
  remoteAppUpdated: boolean
  backendPort: number
  frontendPort: number
  webs: Web[]
}): SendWebhookProcess | undefined {
  const {backendConfig, frontendConfig} = frontAndBackendConfig(webs)
  const webhooksPath =
    webs.map(({configuration}) => configuration.webhooks_path).find((path) => path) || '/api/webhooks'
  const sendUninstallWebhook = Boolean(webhooksPath) && remoteAppUpdated && Boolean(frontendConfig || backendConfig)
  if (!sendUninstallWebhook) {
    return
  }
  return {
    type: 'send-webhook',
    prefix: 'webhooks',
    function: sendWebhook,
    options: {
      deliveryPort: backendConfig ? backendPort : frontendPort,
      webhooksPath,
      ...options,
    },
  }
}
