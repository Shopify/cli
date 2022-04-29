import {Command, Flags} from '@oclif/core'
import {path, output} from '@shopify/cli-kit'

import bundleService from '../../services/bundle'
import archiveService from '../../services/archive'
import {load as loadApp, App} from '../../models/app/app'

export default class Archive extends Command {
  static description = 'Archive the app into a bundle'

  static flags = {
    path: Flags.string({
      char: 'p',
      hidden: false,
      description: 'the path to your app directory',
      required: true,
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Archive)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const parentApp: App = await loadApp(directory)

    const appBundle = await bundleService(parentApp)
    const outputZipPath = await archiveService(appBundle)

    output.message(`\nArchived zip file can be found here: ${outputZipPath}\n`)
  }
}
