import {ALLOWED_ROLES, Role} from '../../utilities/theme-selector/fetch.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {execa} from 'execa'

export default class List extends ThemeCommand {
  static description = 'Lists the themes in your store, along with their IDs and statuses.'

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    password: themeFlags.password,
    store: themeFlags.store,
    role: Flags.custom<Role>({
      description: 'Only list themes with the given role.',
      options: ALLOWED_ROLES,
      env: 'SHOPIFY_FLAG_ROLE',
    })(),
    name: Flags.string({
      description: 'Only list themes that contain the given name.',
      env: 'SHOPIFY_FLAG_NAME',
    }),
    id: Flags.integer({
      description: 'Only list theme with the given ID.',
      env: 'SHOPIFY_FLAG_ID',
    }),
    environment: themeFlags.environment,
  }

  async run(): Promise<void> {
    // const list = ['msg 1', 'msg 2', 'msg 3']

    // const flags = getMultiEnvFlags()

    // for (flag in flags) {
    //   validateFlags() //

    //   console.log(flag)
    //   // out2 = execa('shopify', ['theme', 'list', flag])
    // }

    console.log('???2')
    try {
      const {stdout} = await execa('shopify', ['theme', 'list'])

      console.log(stdout)
    } catch (error) {
      console.error('>>', error)
    }

    // const {flags} = await this.parse(List)
    // const store = ensureThemeStore(flags)
    // const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    // await list(adminSession, flags)
  }
}
