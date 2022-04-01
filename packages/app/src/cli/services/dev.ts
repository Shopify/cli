import {ensureDevEnvironment} from './dev/environment'
import {updateURLs} from './dev/update-urls'
import {createTunnel} from './dev/tunnel'
import {App, Home} from '../models/app/app'
import {output, system} from '@shopify/cli-kit'

interface DevOptions {
  appInfo: App
}

async function dev({appInfo}: DevOptions) {
  const {app, store} = await ensureDevEnvironment(appInfo)
  const url = await createTunnel()
  await updateURLs(app.id, url)
  output.success(`Your app is available at: ${url}/auth?${store.shopDomain}`)
  devHome(appInfo.home)
}

async function devHome(home: Home) {
  const script = home.configuration.commands.dev
  if (!script) {
    return
  }

  const [cmd, ...args] = script.split(' ')
  await system.exec(cmd, args, {cwd: home.directory})
}

export default dev
