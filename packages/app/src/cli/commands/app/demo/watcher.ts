import {appFlags} from '../../../flags.js'
import {AppInterface} from '../../../models/app/app.js'
import {loadApp} from '../../../models/app/loader.js'
import Command from '../../../utilities/app-command.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {AppEventWatcher, EventType} from '../../../services/dev/app-events/app-event-watcher.js'
import colors from '@shopify/cli-kit/node/colors'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {AbortSignal} from '@shopify/cli-kit/node/abort'

export default class DemoWatcher extends Command {
  static summary = 'Watch and prints out changes to an app.'
  static hidden = true

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(DemoWatcher)
    const specifications = await loadLocalExtensionsSpecifications()
    const app: AppInterface = await loadApp({
      specifications,
      directory: flags.path,
      userProvidedConfigName: flags.config,
      mode: 'report',
    })

    const stdoutOptions = {stdout: process.stdout, stderr: process.stderr, signal: new AbortSignal()}
    const watcher = new AppEventWatcher(app, stdoutOptions)
    await watcher.start()
    outputInfo(`Watching for changes in ${app.name}...`)

    watcher.onEvent(async ({extensionEvents, startTime}) => {
      const endTime = process.hrtime(startTime)
      const time = (endTime[0] * 1000 + endTime[1] / 1000000).toFixed(2)
      outputInfo(`🆕 Event [${time}ms]:`)
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
          case EventType.UpdatedSourceFile:
            outputInfo(`  🔄 Updated: ${colors.yellow(event.extension.handle)} (🏗️ needs rebuild)`)
            break
        }
      })
    })

    // Just to keep the process running
    setInterval(() => {}, 1 << 30)
  }
}
