import ImportCustomDataDefinitions from './import/custom-data-definitions.js'
import {AppLinkedCommandOutput} from '../../utilities/app-linked-command.js'
import {renderDeprecatedCommandWarning} from '../../utilities/deprecated-command.js'

/**
 * Deprecated path for `app import custom-data-definitions`. Hidden from help and docs, but still
 * registered so that existing scripts keep working.
 */
export default class ImportCustomDataDefinitionsDeprecated extends ImportCustomDataDefinitions {
  static hidden = true

  // Restated because oclif's manifest builder stops walking the prototype chain at
  // `AppLinkedCommand`, which drops the inherited `--auth-alias` and `--json-schema` flags.
  static flags = {...ImportCustomDataDefinitions.flags}
  static baseFlags = {...ImportCustomDataDefinitions.baseFlags}

  public async run(): Promise<AppLinkedCommandOutput> {
    renderDeprecatedCommandWarning({
      from: 'app import-custom-data-definitions',
      to: 'app import custom-data-definitions',
    })
    return super.run()
  }
}
