import {AppLinkedCommandOutput} from '../../../utilities/app-linked-command.js'
import AppGenerateExtension from '../generate/extension.js'
import {renderWarning} from '@shopify/cli-kit/node/ui'

class AppScaffoldExtension extends AppGenerateExtension {
  static description = 'Scaffold an Extension.'
  static hidden = true
  public async run(): Promise<AppLinkedCommandOutput> {
    renderWarning({
      headline: [
        'The command',
        {command: 'scaffold'},
        'has been deprecated in favor of',
        {command: 'generate'},
        'and will be eventually deleted.',
        'You might need to update the',
        {command: 'scaffold'},
        "script in the project's package.json.",
      ],
    })
    return super.run()
  }
}

export default AppScaffoldExtension
