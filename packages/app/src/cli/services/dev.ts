import {ensureDevEnvironment} from './dev/environment'
import {updateURLs} from './dev/update-urls'
import {createTunnel} from './dev/tunnel'
import {App, Home} from '../models/app/app'
import {output, system} from '@shopify/cli-kit'

interface DevOptions {
  app: App
}

interface DevHomeOptions {
  apiKey: string
  apiSecret: string
  hostname: string
}

async function dev({app}: DevOptions) {
  const {
    app: {
      id: appId,
      apiKey,
      apiSecretKeys: {secret: apiSecret},
    },
    store,
  } = await ensureDevEnvironment(app)
  const url = await createTunnel()
  await updateURLs(appId, url)
  output.success(`Your app is available at: ${url}/auth?${store.shopDomain}`)
  devHome(app.home, {
    apiKey,
    apiSecret,
    hostname: url,
  })
}

async function devHome(home: Home, options: DevHomeOptions) {
  const script = home.configuration.commands.dev
  if (!script) {
    return
  }

  const [cmd, ...args] = script.split(' ')
  await system.exec(cmd, args, {
    cwd: home.directory,
    env: {
      ...process.env,
      API_KEY: options.apiKey,
      API_SECRET_KEY: options.apiSecret,
      HOST_NAME: options.hostname.replace(/https:\/\//, ''),
    },
  })
}

export default dev
