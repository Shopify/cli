/* eslint-disable @typescript-eslint/naming-convention */
import {metadata as metadataLib} from '@shopify/cli-kit'

const metadata = metadataLib.createRuntimeMetadataContainer<{
  project_type: string
  partner_id: number
  api_key: string
}>()

export default metadata
