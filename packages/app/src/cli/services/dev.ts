import {ensureDevEnvironment} from './dev/environment'
import {generateURL, updateURLs} from './dev/urls'
import {App, AppConfiguration, Web, WebType} from '../models/app/app'
import {output, port, system} from '@shopify/cli-kit'
import {Plugin} from '@oclif/core/lib/interfaces'

export interface DevOptions {
  appManifest: App
  apiKey?: string
  store?: string
  reset: boolean
  tunnel: boolean
  update: boolean
  plugins: Plugin[]
}

interface DevWebOptions {
  frontendPort: number
  backendPort: number
  apiKey: string
  apiSecret: string
  hostname: string
  scopes: AppConfiguration['scopes']
}

async function dev(input: DevOptions) {
  const {
    app: {apiKey, apiSecretKeys},
    store,
  } = await ensureDevEnvironment(input)

  const frontendPort = await port.getRandomPort()
  const backendPort = await port.getRandomPort()
  const url: string = await generateURL(input, frontendPort)
  if (input.update) await updateURLs(apiKey, url)

  const storeAppUrl = `${url}/api/auth?shop=${store}`

  output.info(output.content`
  Your app is up and running! ✨
  View it at: ${output.token.link(storeAppUrl, storeAppUrl)}
  `)

  devWeb(input.appManifest.webs, {
    apiKey,
    frontendPort,
    backendPort,
    scopes: input.appManifest.configuration.scopes,
    apiSecret: apiSecretKeys[0].secret,
    hostname: url,
  })
}

async function devWeb(webs: Web[], options: DevWebOptions) {
  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SHOPIFY_API_KEY = options.apiKey

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SHOPIFY_API_SECRET = options.apiSecret

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const HOST = options.hostname

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const SCOPES = options.scopes

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const FRONTEND_PORT = `${options.frontendPort}`

  // eslint-disable-next-line @shopify/prefer-module-scope-constants
  const BACKEND_PORT = `${options.backendPort}`

  await output.concurrent(
    webs.map(({configuration, directory}: Web, _index) => {
      const {commands, type} = configuration
      const [cmd, ...args] = commands.dev.split(' ')
      const env =
        type === WebType.Backend
          ? {
              SHOPIFY_API_KEY,
              SHOPIFY_API_SECRET,
              HOST,
              BACKEND_PORT,
              SCOPES,
            }
          : {
              SHOPIFY_API_KEY,
              BACKEND_PORT,
              FRONTEND_PORT,
            }

      return {
        prefix: configuration.type,
        action: async (stdout, stderr) => {
          await system.exec(cmd, args, {
            cwd: directory,
            stdout,
            stderr,
            env: {
              ...process.env,
              ...env,
              NODE_ENV: `development`,
            },
          })
        },
      }
    }),
  )
}

export default dev
