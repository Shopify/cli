import {appFlags} from '../../../flags.js'
import {MIGRATABLE_SUBSCRIPTION_STATUSES} from '../../../models/subscription-migrations.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'
import {resolvePath} from '@shopify/cli-kit/node/path'

const sharedFlags = {
  ...globalFlags,
  ...appFlags,
  ...jsonFlag,
}

const watchFlag = {
  watch: Flags.boolean({
    description:
      'Display the current operation state while polling, then output the final outcome when every operation reaches a terminal status.',
    env: 'SHOPIFY_FLAG_WATCH',
    default: false,
  }),
}

const statusWatchFlag = {
  watch: Flags.boolean({
    description:
      'Display the current operation state while polling, then output the final state when every operation reaches a terminal status.',
    env: 'SHOPIFY_FLAG_WATCH',
    default: false,
  }),
}

export const listFlags = {
  ...sharedFlags,
  output: Flags.string({
    description: 'Path to write the subscription export.',
    env: 'SHOPIFY_FLAG_OUTPUT',
    parse: async (input) => resolvePath(input),
  }),
  status: Flags.option({
    description: 'Filter subscriptions by migration status.',
    env: 'SHOPIFY_FLAG_STATUS',
    options: [...MIGRATABLE_SUBSCRIPTION_STATUSES],
  })(),
  force: Flags.boolean({
    char: 'f',
    description: 'Overwrite an existing output file.',
    env: 'SHOPIFY_FLAG_FORCE',
    default: false,
  }),
}

export const submissionFlags = {
  ...sharedFlags,
  input: Flags.string({
    char: 'i',
    description: 'Path to the migration CSV. If omitted, standard input is used.',
    env: 'SHOPIFY_FLAG_INPUT',
  }),
  force: requiredIfNonInteractive(
    Flags.boolean({
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
      default: false,
    }),
  ),
  ...watchFlag,
}

export const operationFlags = {
  ...sharedFlags,
  id: Flags.string({
    description: 'The app subscription migration operation ID. Can be specified multiple times.',
    env: 'SHOPIFY_FLAG_ID',
    required: true,
    multiple: true,
  }),
}

export const statusFlags = {
  ...operationFlags,
  ...statusWatchFlag,
}
