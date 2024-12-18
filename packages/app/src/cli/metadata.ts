import {MonorailEventPublic, MonorailEventSensitive} from '@shopify/cli-kit/node/monorail'
import {createRuntimeMetadataContainer} from '@shopify/cli-kit/node/metadata'
import type {PickByPrefix} from '@shopify/cli-kit/common/ts/pick-by-prefix'

type CmdFieldsFromMonorail = PickByPrefix<MonorailEventPublic, 'cmd_extensions_' | 'cmd_app_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_shared_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_scaffold_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_dev_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_deploy_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_release_'> &
  PickByPrefix<MonorailEventPublic, 'app_'> &
  PickByPrefix<MonorailEventPublic, 'env_'> &
  PickByPrefix<MonorailEventPublic, 'store_'>

type CmdSensitiveFieldsFromMonorail = PickByPrefix<MonorailEventSensitive, 'app_'> &
  PickByPrefix<MonorailEventSensitive, 'cmd_dev_'> &
  PickByPrefix<MonorailEventSensitive, 'store_'>

const metadata = createRuntimeMetadataContainer<
  {
    project_type: string
    partner_id: number
    api_key: string
  } & CmdFieldsFromMonorail,
  CmdSensitiveFieldsFromMonorail
>({
  cmd_app_warning_api_key_deprecation_displayed: false,
})

export default metadata
