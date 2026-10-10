import {appFlags} from '../../../flags.js'
import {Flags} from '@oclif/core'

type WithoutAppConfigRelationship = Pick<
  NonNullable<Parameters<typeof Flags.boolean>[0]>,
  'dependsOn' | 'relationships'
>

function withoutAppConfigFlag(relationship: WithoutAppConfigRelationship) {
  return Flags.boolean({
    description:
      'Scan --path as an app with no app configuration file. Config checks are skipped. Requires --client-id.',
    env: 'SHOPIFY_FLAG_WITHOUT_APP_CONFIG',
    exclusive: ['config'],
    ...relationship,
  })
}

/** The flags that select which app and results every `app security` command works on. */
export const appSecuritySelectionFlags = {
  path: appFlags.path,
  config: appFlags.config,
  'client-id': appFlags['client-id'],
  'without-app-config': withoutAppConfigFlag({dependsOn: ['client-id']}),
}

/** `clean --all` needs no client ID, so `--without-app-config` only requires one when `--all` is absent. */
export const appSecurityCleanSelectionFlags = {
  ...appSecuritySelectionFlags,
  'without-app-config': withoutAppConfigFlag({
    relationships: [{type: 'all', flags: [{name: 'client-id', when: async (flags) => !flags.all}]}],
  }),
}
