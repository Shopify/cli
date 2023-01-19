import {metadata as metadataLib, monorail} from '@shopify/cli-kit'
import type {PickByPrefix} from '@shopify/cli-kit/common/ts/pick-by-prefix'

type CmdFieldsFromMonorail = PickByPrefix<monorail.MonorailEventPublic, 'cmd_extensions_'> &
  PickByPrefix<monorail.MonorailEventPublic, 'cmd_shared_'> &
  PickByPrefix<monorail.MonorailEventPublic, 'cmd_scaffold_'> &
  PickByPrefix<monorail.MonorailEventPublic, 'cmd_dev_'> &
  PickByPrefix<monorail.MonorailEventPublic, 'app_'> &
  PickByPrefix<monorail.MonorailEventPublic, 'env_'>

type CmdSensitiveFieldsFromMonorail = PickByPrefix<monorail.MonorailEventSensitive, 'app_'> &
  PickByPrefix<monorail.MonorailEventSensitive, 'cmd_dev_'>

const metadata = metadataLib.createRuntimeMetadataContainer<
  {
    project_type: string
    partner_id: number
    api_key: string
  } & CmdFieldsFromMonorail,
  CmdSensitiveFieldsFromMonorail
>()

export default metadata
