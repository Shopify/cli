import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {loadApp} from '../../../models/app/loader.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {AppEventWatcher, EventType} from '../../../services/dev/app-events/app-event-watcher.js'
import AppCommand, {AppCommandOutput} from '../../../utilities/app-command.js'
import colors from '@shopify/cli-kit/node/colors'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {endHRTimeInMs} from '@shopify/cli-kit/node/hrtime'

export default class DemoWatcher extends AppCommand {
  static summary = 'Watch and prints out changes to an app.'
  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<AppCommandOutput> {
    const {flags} = await this.parse(DemoWatcher)
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      userProvidedConfigName: flags.config,
      mode: 'report',
    })

    const watcher = new AppEventWatcher(app)
    await watcher.start()
    outputInfo(`Watching for changes in ${app.name}...`)

    watcher.onEvent(async ({app: _newApp, extensionEvents, startTime, path}) => {
      outputInfo(`🆕 Event [${endHRTimeInMs(startTime)}ms]`)
      outputInfo(`  📂 ${path}`)
      extensionEvents.forEach((event) => {
        switch (event.type) {
          case EventType.Created:
            outputInfo(`  ✅ Extension created - ${colors.green(event.extension.handle)}`)
            break
          case EventType.Deleted:
            outputInfo(`  ❌ Extension deleted: ${colors.red(event.extension.handle)}`)
            break
          case EventType.Updated:
            outputInfo(`  🔄 Updated: ${colors.yellow(event.extension.handle)}`)
            break
        }
      })
    })

    // Just to keep the process running
    setInterval(() => {}, 1 << 30)
    return {app}
  }
}
