import {bundle} from '../../services/bundle'
import {archive} from '../../services/archive'
import {load as loadApp, App} from '../../models/app/app'
import {appFlags} from '../../flags'
import {path, output} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'

export default class Archive extends Command {
  static description = 'Archive the app into a bundle'

  static flags = {
    ...appFlags,
    output: Flags.string({
      hidden: false,
      required: false,
      description: 'The path to the zip file that will be generated',
      env: 'SHOPIFY_FLAG_OUTPUT',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Archive)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    const zipPath = flags.output ?? path.join(app.directory, `${app.configuration.name}.zip`)
    const appBundle = await bundle(app)
    await archive(appBundle, zipPath)
    output.success(`The app has been archived at: ${zipPath}`)
  }
}
