import {metadata as metadataLib, monorail} from '@shopify/cli-kit'
import type {PickByPrefix} from '@shopify/cli-kit/typing/pick-by-prefix'

type CmdFieldsFromMonorail = PickByPrefix<monorail.MonorailEventPublic, 'cmd_extensions_'> &
  PickByPrefix<monorail.MonorailEventPublic, 'cmd_scaffold_'> &
  PickByPrefix<monorail.MonorailEventPublic, 'app_'>

const metadata = metadataLib.createRuntimeMetadataContainer<
  {
    project_type: string
    partner_id: number
    api_key: string
  } & CmdFieldsFromMonorail
>()

export default metadata
