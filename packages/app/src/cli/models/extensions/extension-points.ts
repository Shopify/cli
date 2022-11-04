import {ExtensionPointSchema} from './schemas.js'
import {schema} from '@shopify/cli-kit'

type BasePointConfigContents = schema.define.infer<typeof ExtensionPointSchema>

/**
 * Extension Point specification
 */
export interface ExtensionPointSpec {
  type: string
  resourceUrl?: (config: BasePointConfigContents) => string
  previewMessage?: (config: BasePointConfigContents) => string
}
