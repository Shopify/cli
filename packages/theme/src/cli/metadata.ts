import {MonorailEventPublic, MonorailEventSensitive} from '@shopify/cli-kit/node/monorail'
import {createRuntimeMetadataContainer} from '@shopify/cli-kit/node/metadata'
import type {PickByPrefix} from '@shopify/cli-kit/common/ts/pick-by-prefix'

// Include both theme-specific fields AND store fields
type CmdFieldsFromMonorail = PickByPrefix<MonorailEventPublic, 'cmd_theme_'> &
  PickByPrefix<MonorailEventPublic, 'store_'>

type CmdSensitiveFieldsFromMonorail = PickByPrefix<MonorailEventSensitive, 'store_'>

const metadata = createRuntimeMetadataContainer<CmdFieldsFromMonorail, CmdSensitiveFieldsFromMonorail>({})

export default metadata
