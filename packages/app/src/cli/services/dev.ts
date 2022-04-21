import {ensureDevEnvironment} from './dev/environment'
import {updateURLs} from './dev/update-urls'
import {createTunnel} from './dev/tunnel'
import {App, Home} from '../models/app/app'
import {output, system} from '@shopify/cli-kit'

interface DevOptions {
  appManifest: App
  apiKey?: string
  store?: string
  reset: boolean
  tunnel: boolean
  update: boolean
}

interface DevHomeOptions {
  port: number
  apiKey: string
  apiSecret: string
  hostname: string
}

async function dev(input: DevOptions) {
  const {
    app: {apiKey, apiSecretKeys},
    store,
  } = await ensureDevEnvironment(input)
  const port = 3000
  let url = `http://localhost:${port}`

  if (input.tunnel) url = await createTunnel({port})
  if (input.update) await updateURLs(apiKey, url)

  output.success(`Your app is available at: ${url}/auth?shop=${store.shopDomain}`)
  devHome(input.appManifest.home, {
    apiKey,
    apiSecret: apiSecretKeys[0].secret,
    hostname: url,
    port,
  })
}

async function devHome(home: Home, options: DevHomeOptions) {
  const script = home.configuration.commands.dev
  if (!script) {
    return
  }

  const [cmd, ...args] = script.split(' ')

  await output.concurrent([
    {
      prefix: 'home',
      action: async (stdout, stderr) => {
        await system.exec(cmd, args, {
          cwd: home.directory,
          stdout,
          env: {
            ...process.env,
            SHOPIFY_API_KEY: options.apiKey,
            SHOPIFY_API_SECRET: options.apiSecret,
            HOST: options.hostname,
            SCOPES: 'write_products,write_customers,write_draft_orders',
            PORT: `${options.port}`,
            NODE_ENV: `development`,
          },
        })
      },
    },
  ])
}

export default dev
