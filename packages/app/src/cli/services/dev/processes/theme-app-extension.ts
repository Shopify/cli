import {BaseProcess, DevProcessFunction} from './types.js'
import {ExtensionInstance} from '../../../models/extensions/extension-instance.js'
import {HostThemeManager} from '../../../utilities/host-theme-manager.js'
import {themeExtensionArgs} from '../theme-extension-args.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {ExtensionUpdateDraftInput} from '../../../api/graphql/update_draft.js'
import {camelize} from '@shopify/cli-kit/common/string'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {getAvailableTCPPort} from '@shopify/cli-kit/node/tcp'
import {AdminSession, ensureAuthenticatedAdmin, ensureAuthenticatedStorefront} from '@shopify/cli-kit/node/session'
import {createApp, createRouter, IncomingMessage, send, readBody, readRawBody} from 'h3'
import {createServer} from 'http'
import {Writable} from 'stream'

export interface PreviewThemeAppExtensionsOptions {
  apiKey: string
  adminSession: AdminSession
  themeExtensionServerArgs: string[]
  storefrontToken: string
  developerPlatformClient: DeveloperPlatformClient
  draftUpdatePort: number
  handle: string
}

export interface PreviewThemeAppExtensionsProcess extends BaseProcess<PreviewThemeAppExtensionsOptions> {
  type: 'theme-app-extensions'
}

export const runThemeAppExtensionsServer: DevProcessFunction<PreviewThemeAppExtensionsOptions> = async (
  {stdout, stderr, abortSignal},
  {adminSession, themeExtensionServerArgs: args, storefrontToken, developerPlatformClient, draftUpdatePort, handle},
) => {
  const draftUpdateServer = createDraftUpdateServer({draftUpdatePort, developerPlatformClient, handle, stdout})
  abortSignal.addEventListener('abort', () => {
    draftUpdateServer.close()
  })

  await refreshToken(developerPlatformClient)
  await execCLI2(['extension', 'serve', ...args], {
    store: adminSession.storeFqdn,
    adminToken: adminSession.token,
    storefrontToken,
    stdout,
    stderr,
    signal: abortSignal,
  })
}

export async function setupPreviewThemeAppExtensionsProcess({
  allExtensions,
  apiKey,
  storeFqdn,
  theme,
  themeExtensionPort,
  notify,
  developerPlatformClient,
  draftUpdatePort,
}: Pick<PreviewThemeAppExtensionsOptions, 'developerPlatformClient'> & {
  allExtensions: ExtensionInstance[]
  apiKey: string
  storeFqdn: string
  theme?: string
  notify?: string
  themeExtensionPort?: number
  draftUpdatePort?: number
}): Promise<PreviewThemeAppExtensionsProcess | undefined> {
  if (!draftUpdatePort) {
    draftUpdatePort = await getAvailableTCPPort()
  }

  const themeExtensions = allExtensions.filter((ext) => ext.isThemeExtension)
  if (themeExtensions.length === 0) {
    return
  }

  const adminSession = await ensureAuthenticatedAdmin(storeFqdn)
  const extension = themeExtensions[0]!
  let optionsToOverwrite = {}
  if (!theme) {
    const theme = await new HostThemeManager(adminSession).findOrCreate()
    optionsToOverwrite = {
      theme: theme.id.toString(),
      generateTmpTheme: true,
    }
  }
  const [storefrontToken, args] = await Promise.all([
    ensureAuthenticatedStorefront(),
    themeExtensionArgs(extension, apiKey, developerPlatformClient, draftUpdatePort, {
      theme,
      themeExtensionPort,
      notify,
      ...optionsToOverwrite,
    }),
  ])

  return {
    type: 'theme-app-extensions',
    prefix: 'extensions',
    function: runThemeAppExtensionsServer,
    options: {
      apiKey,
      adminSession,
      themeExtensionServerArgs: args,
      storefrontToken,
      developerPlatformClient,
      draftUpdatePort,
      handle: extension.handle,
    },
  }
}

async function refreshToken(developerPlatformClient: DeveloperPlatformClient) {
  const newToken = await developerPlatformClient.refreshToken()
  if (useEmbeddedThemeCLI()) {
    await execCLI2(['theme', 'token', '--partners', newToken])
  }
}

interface CreateDraftUpdateServerOptions {
  draftUpdatePort: number
  developerPlatformClient: DeveloperPlatformClient
  stdout: Writable
  handle: string
}

function createDraftUpdateServer({draftUpdatePort, developerPlatformClient, stdout, handle}: CreateDraftUpdateServerOptions) {
  const httpApp = createApp()
  const httpRouter = createRouter()
  httpRouter.use('/update', async (ctx: IncomingMessage) => {
    const rawBody = await readRawBody(ctx)
    const parsed = JSON.parse(rawBody.toString())
    const data = convertObjectKeysSnakeToCamelCase(parsed) as Omit<ExtensionUpdateDraftInput, 'handle'>
    const result = await developerPlatformClient.updateThemeExtension({handle, ...data})
    return send(ctx, Buffer.from(JSON.stringify(result)), 'application/json')
  }, 'post')
  httpApp.use(httpRouter)
  const httpServer = createServer(httpApp)
  httpServer.listen(draftUpdatePort)
  stdout.write("Listening on port " + draftUpdatePort)
  return httpServer
}

function convertObjectKeysSnakeToCamelCase(obj: Record<string, any>) {
  const newObj: Record<string, any> = {}
  for (const key in obj) {
    newObj[camelize(key)] = obj[key]
  }
  return newObj
}
