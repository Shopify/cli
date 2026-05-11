import {writeConfig} from '../../services/flow/project-config.js'
import StoreCommand from '../../utilities/store-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {mkdir} from '@shopify/cli-kit/node/fs'
import {outputResult} from '@shopify/cli-kit/node/output'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {Args, Flags} from '@oclif/core'

export default class FlowInit extends StoreCommand {
  static summary = 'Initialize a Flow IaC project (creates the directory and writes flow.toml).'

  static descriptionWithMarkdown = `Writes a \`flow.toml\` with the store handle and workflow directory. Pass a path to create (or use) a project directory; defaults to the current directory.

Lifecycle commands (\`workflow validate/push/pull/diff/activate/deactivate/status\`) read this file when their --store and --workflows-dir flags aren't passed. Refuses to overwrite an existing file unless --force is set.`

  static description = this.descriptionWithoutMarkdown()

  static examples = [
    '<%= config.bin %> <%= command.id %> --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> ./shop1 --store shop.myshopify.com',
    '<%= config.bin %> <%= command.id %> ./shop1 --store shop.myshopify.com --workflows-dir flows --force',
  ]

  static args = {
    path: Args.string({
      description: 'Project directory to create (or reuse). Defaults to the current directory.',
      required: false,
    }),
  }

  static flags = {
    ...globalFlags,
    store: Flags.string({
      char: 's',
      description: 'The myshopify.com domain of the store this project tracks.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
      required: true,
    }),
    'workflows-dir': Flags.string({
      description: 'Directory (relative to flow.toml) where workflow JSON files live. Defaults to `workflows`.',
      env: 'SHOPIFY_FLAG_FLOW_WORKFLOWS_DIR',
    }),
    force: Flags.boolean({
      description: 'Overwrite an existing flow.toml.',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {args, flags} = await this.parse(FlowInit)

    const dir = args.path ? resolvePath(cwd(), args.path) : cwd()
    if (args.path) await mkdir(dir)

    const path = await writeConfig({
      dir,
      store: flags.store,
      workflowsDir: flags['workflows-dir'],
      force: flags.force,
    })

    outputResult(`Wrote ${path}.`)
  }
}
