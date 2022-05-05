import {upload} from '../../services/upload'
import {load as loadApp, App} from '../../models/app/app'
import {appFlags} from '../../flags'
import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'

export default class Upload extends Command {
  static description = 'Deploy the app'

  static flags = {
    ...appFlags,
    archive: Flags.string({
      hidden: false,
      required: true,
      parse: (input, _) => Promise.resolve(path.resolve(input)),
      description: 'The path to the app archive zip file.',
      env: 'SHOPIFY_FLAG_ARCHIVE',
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Upload)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const app: App = await loadApp(directory)
    await upload({app, archivePath: flags.archive})
  }
}
