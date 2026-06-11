import {listStores} from '../../services/store/list/index.js'
import {type StoreListRequestedSource} from '../../services/store/list/types.js'
import {writeStoreListResult} from '../../services/store/list/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

const STORE_LIST_SOURCES: StoreListRequestedSource[] = ['auto', 'organization', 'store-auth']

export default class StoreList extends StoreCommand {
  static summary = 'List stores available to the current CLI session.'

  static descriptionWithMarkdown = `Lists stores available to the current Shopify CLI session.

By default, the command uses \
\`--from auto\`:\n- a selected Shopify organization when the current CLI session can be used without reauthentication\n- the locally stored store auth cache when the organization can't be listed for the current session

When more than one organization is available, the command prompts you to pick one unless you provide \
\`--organization-id\`.
In non-interactive environments, provide \
\`--organization-id\`.

Use \
\`--from organization\` to only list organization stores, or \
\`--from store-auth\` to inspect only stores connected with \
\`shopify store auth\`.

Run \
\`shopify organization list\` to find organization IDs.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --from organization',
    '<%= config.bin %> <%= command.id %> --organization-id 1234567',
    '<%= config.bin %> <%= command.id %> --from store-auth',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    from: Flags.string({
      description:
        'Source for the listing. `auto` prefers your Shopify organization and falls back to locally stored store auth when necessary.',
      env: 'SHOPIFY_FLAG_STORE_LIST_FROM',
      options: STORE_LIST_SOURCES,
      default: 'auto',
      required: false,
    }),
    'organization-id': Flags.string({
      description:
        'Filters the store list by organization. If omitted and you belong to more than one organization, you will be prompted to choose one. Only valid with `--from auto` or `--from organization`.',
      env: 'SHOPIFY_FLAG_ORGANIZATION_ID',
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreList)
    const result = await listStores({
      source: flags.from as StoreListRequestedSource,
      organizationId: flags['organization-id'],
    })

    writeStoreListResult(result, flags.json ? 'json' : 'text')
  }
}
