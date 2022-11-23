import {ExtensionPointSchema} from './schemas.js'
import {schema} from '@shopify/cli-kit'

type BasePointConfigContents = schema.define.infer<typeof ExtensionPointSchema>

/**
 * Extension Point specification
 */

// PENDING: Define the interface to support multiple extension points that behave in a similar way
// like checkout surface

// MAYBE: Infer the surface from the extension point target, do not register specific points. Assume same surface redirects to the same url
export interface ExtensionPointSpec {
  type: string
  redirectUrl?: (config: BasePointConfigContents) => string
  previewMessage?: (config: BasePointConfigContents) => string
}
