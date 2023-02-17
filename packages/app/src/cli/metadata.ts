import {MonorailEventPublic, MonorailEventSensitive} from '@shopify/cli-kit/node/monorail'
import {createRuntimeMetadataContainer} from '@shopify/cli-kit/node/metadata'
import type {PickByPrefix} from '@shopify/cli-kit/common/ts/pick-by-prefix'

type CmdFieldsFromMonorail = PickByPrefix<MonorailEventPublic, 'cmd_extensions_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_shared_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_scaffold_'> &
  PickByPrefix<MonorailEventPublic, 'cmd_dev_'> &
  PickByPrefix<MonorailEventPublic, 'app_'> &
  PickByPrefix<MonorailEventPublic, 'env_'>

type CmdSensitiveFieldsFromMonorail = PickByPrefix<MonorailEventSensitive, 'app_'> &
  PickByPrefix<MonorailEventSensitive, 'cmd_dev_'>

const metadata = createRuntimeMetadataContainer<
  {
    project_type: string
    partner_id: number
    api_key: string
  } & CmdFieldsFromMonorail,
  CmdSensitiveFieldsFromMonorail
>()

export default metadata
