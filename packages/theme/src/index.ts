import CheckCommand from './cli/commands/theme/check.js'
import ConsoleCommand from './cli/commands/theme/console.js'
import DeleteCommand from './cli/commands/theme/delete.js'
import Dev from './cli/commands/theme/dev.js'
import Duplicate from './cli/commands/theme/duplicate.js'
import GitMergePreserve from './cli/commands/theme/git-merge-preserve.js'
import GitSetup from './cli/commands/theme/git-setup.js'
import ThemeInfo from './cli/commands/theme/info.js'
import Init from './cli/commands/theme/init.js'
import LanguageServer from './cli/commands/theme/language-server.js'
import ListCommnd from './cli/commands/theme/list.js'
import Open from './cli/commands/theme/open.js'
import Package from './cli/commands/theme/package.js'
import Profile from './cli/commands/theme/profile.js'
import Publish from './cli/commands/theme/publish.js'
import MetafieldsPull from './cli/commands/theme/metafields/pull.js'
import Pull from './cli/commands/theme/pull.js'
import Push from './cli/commands/theme/push.js'
import Rename from './cli/commands/theme/rename.js'
import Serve from './cli/commands/theme/serve.js'
import Share from './cli/commands/theme/share.js'

const COMMANDS = {
  'theme:init': Init,
  'theme:check': CheckCommand,
  'theme:console': ConsoleCommand,
  'theme:delete': DeleteCommand,
  'theme:dev': Dev,
  'theme:duplicate': Duplicate,
  'theme:git-merge-preserve': GitMergePreserve,
  'theme:git-setup': GitSetup,
  'theme:info': ThemeInfo,
  'theme:language-server': LanguageServer,
  'theme:list': ListCommnd,
  'theme:metafields:pull': MetafieldsPull,
  'theme:open': Open,
  'theme:package': Package,
  'theme:profile': Profile,
  'theme:publish': Publish,
  'theme:pull': Pull,
  'theme:push': Push,
  'theme:rename': Rename,
  'theme:serve': Serve,
  'theme:share': Share,
}

export default COMMANDS

/** Development server for theme extensions */
export * from './cli/utilities/theme-ext-environment/theme-ext-server.js'

/** Storefront authentication support for running the development server on password-protected stores */
export {isStorefrontPasswordProtected} from './cli/utilities/theme-environment/storefront-session.js'
export {ensureValidPassword} from './cli/utilities/theme-environment/storefront-password-prompt.js'

// Expose core utilities for developers to build and expand on the CLI
export {pull} from './cli/services/pull.js'
export {push} from './cli/services/push.js'
export {publicFetchStoreThemes as fetchStoreThemes} from './cli/utilities/theme-selector/fetch.js'
