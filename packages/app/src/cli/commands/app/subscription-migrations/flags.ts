import {appFlags} from '../../../flags.js'
import {Flags} from '@oclif/core'
import {authAliasFlag, globalFlags, jsonFlag, requiredIfNonInteractive} from '@shopify/cli-kit/node/cli'

const sharedFlags = {
  ...globalFlags,
  ...jsonFlag,
  ...authAliasFlag,
  path: appFlags.path,
  config: appFlags.config,
  'client-id': appFlags['client-id'],
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

export const submissionFlags = {
  ...sharedFlags,
  input: Flags.string({
    char: 'i',
    description: 'Path to the migration CSV. If omitted, standard input is used.',
    env: 'SHOPIFY_FLAG_INPUT',
  }),
  'idempotency-key': Flags.string({
    description: 'Reuse an existing root idempotency key for the same action and input.',
    env: 'SHOPIFY_FLAG_IDEMPOTENCY_KEY',
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
