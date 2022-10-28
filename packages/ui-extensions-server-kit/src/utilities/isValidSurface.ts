/* eslint-disable @shopify/strict-component-boundaries */
import {AVAILABLE_SURFACES} from '../ExtensionServerClient/types.js'
import type {Surface} from '../ExtensionServerClient/types'

export function isValidSurface(surface: any): surface is Surface {
  return surface && AVAILABLE_SURFACES.includes(surface)
}
