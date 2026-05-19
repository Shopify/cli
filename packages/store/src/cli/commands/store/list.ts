import {listStoredStores, type StoreListEntryKind} from '../../services/store/list/index.js'
import {writeStoreListResult} from '../../services/store/list/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

const STORE_LIST_KINDS: StoreListEntryKind[] = ['standard', 'preview']

export default class StoreList extends StoreCommand {
  static summary = 'List stored store-auth sessions.'

  static descriptionWithMarkdown = `Lists every store that has a locally stored auth session, including both standard PKCE-authenticated stores (via \`shopify store auth\`) and preview stores (via \`shopify store create preview\`).

Use \`--kind\` to filter by session type, or \`--json\` to emit a machine-readable list for agent consumption.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --kind preview',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    kind: Flags.string({
      description: 'Filter results to a single session kind.',
      env: 'SHOPIFY_FLAG_STORE_LIST_KIND',
      options: STORE_LIST_KINDS,
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreList)

    const entries = listStoredStores({
      kind: flags.kind as StoreListEntryKind | undefined,
    })

    writeStoreListResult(entries, flags.json ? 'json' : 'text')
  }
}
