import ImportDashboardExtensions from './import/dashboard-extensions.js'
import {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {renderDeprecatedCommandWarning} from '../../utilities/deprecated-command.js'

/**
 * Deprecated path for `app import dashboard-extensions`. Hidden from help and docs, but still
 * registered so that existing scripts keep working.
 */
export default class ImportExtensions extends ImportDashboardExtensions {
  static hidden = true

  // Restated because oclif's manifest builder stops walking the prototype chain at
  // `AppLinkedCommand`, which drops the inherited `--auth-alias` and `--json-schema` flags.
  static flags = {...ImportDashboardExtensions.flags}
  static baseFlags = {...ImportDashboardExtensions.baseFlags}

  async run(): Promise<AppLinkedCommandOutput> {
    renderDeprecatedCommandWarning({from: 'app import-extensions', to: 'app import dashboard-extensions'})
    return super.run()
  }
}
