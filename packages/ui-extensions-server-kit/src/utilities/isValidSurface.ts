import {AVAILABLE_SURFACES} from '../ExtensionServerClient/types'
import type {Surface} from '../ExtensionServerClient/types'

export function isValidSurface(surface: any): surface is Surface {
  return surface && AVAILABLE_SURFACES.includes(surface)
}
