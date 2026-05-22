import {listStoredStores, type StoreListEntryKind, type StoreListSource} from '../../services/store/list/index.js'
import {writeStoreListResult} from '../../services/store/list/result.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

const STORE_LIST_KINDS: StoreListEntryKind[] = ['standard', 'preview']
const STORE_LIST_SOURCES: StoreListSource[] = ['bp', 'local']

export default class StoreList extends StoreCommand {
  static summary = 'List stores accessible to the current Shopify CLI session.'

  static descriptionWithMarkdown = `Lists every shop the currently-authenticated Shopify account has access to.

By default (\`--source bp\`) the command queries Business Platform across every organization the logged-in user belongs to, mirroring the stores you'd see in the Shopify admin. Use \`--source local\` to enumerate only the locally-cached store-auth sessions (including preview stores created by \`shopify store create preview\` that haven't propagated to BP yet).

The \`--kind\` filter only applies to \`--source local\` because BP-sourced entries don't carry the local-cache \`standard\` / \`preview\` discriminator.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --source local',
    '<%= config.bin %> <%= command.id %> --source local --kind preview',
    '<%= config.bin %> <%= command.id %> --search "preview-"',
    '<%= config.bin %> <%= command.id %> --json',
  ]

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    source: Flags.string({
      description:
        'Data source for the listing. `bp` (default) queries Business Platform for the logged-in account; `local` enumerates the on-disk store-auth cache.',
      env: 'SHOPIFY_FLAG_STORE_LIST_SOURCE',
      options: STORE_LIST_SOURCES,
      default: 'bp',
      required: false,
    }),
    search: Flags.string({
      description: 'Free-text search forwarded to BP. Ignored when `--source local`.',
      env: 'SHOPIFY_FLAG_STORE_LIST_SEARCH',
      required: false,
    }),
    kind: Flags.string({
      description: 'Filter results to a single session kind. Only applies to `--source local`.',
      env: 'SHOPIFY_FLAG_STORE_LIST_KIND',
      options: STORE_LIST_KINDS,
      required: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(StoreList)

    const result = await listStoredStores({
      source: flags.source as StoreListSource,
      ...(flags.search ? {search: flags.search} : {}),
      ...(flags.kind ? {kind: flags.kind as StoreListEntryKind} : {}),
    })

    writeStoreListResult(result, flags.json ? 'json' : 'text')
  }
}
