import {preserveEnvironmentMerge} from '../../utilities/theme-merge.js'
import {Args} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {outputDebug} from '@shopify/cli-kit/node/output'

/**
 * Git merge driver for Shopify theme files
 * This command is called directly by Git during merge operations
 * Arguments are provided by Git's merge driver system
 */
export default class GitMergePreserve extends Command {
  static description = 'Git merge driver for Shopify theme environment-specific files (internal use)'

  // Hide from help as this is called by Git, not users
  static hidden = true

  static args = {
    base: Args.string({
      description: 'Base/ancestor file path (%O)',
      required: true,
    }),
    current: Args.string({
      description: 'Current branch file path (%A)',
      required: true,
    }),
    incoming: Args.string({
      description: 'Incoming branch file path (%B)',
      required: true,
    }),
    markerSize: Args.string({
      description: 'Conflict marker size (%L)',
      required: false,
    }),
  }

  async run(): Promise<void> {
    const {args} = await this.parse(GitMergePreserve)

    const markerSize = args.markerSize ? parseInt(args.markerSize, 10) : 7

    outputDebug(`Git merge driver called: ${args.current}`)

    const result = await preserveEnvironmentMerge(args.base, args.current, args.incoming, markerSize)

    // Exit code 0 = successful merge, 1 = conflict (let Git handle), >1 = error
    process.exit(result.success ? 0 : 1)
  }
}
