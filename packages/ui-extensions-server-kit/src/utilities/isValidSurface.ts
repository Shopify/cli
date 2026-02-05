import {AVAILABLE_SURFACES} from '../ExtensionServerClient/types'
import type {Surface} from '../ExtensionServerClient/types'

export function isValidSurface(surface: unknown): surface is Surface {
  return Boolean(surface) && AVAILABLE_SURFACES.includes(surface as Surface)
}
