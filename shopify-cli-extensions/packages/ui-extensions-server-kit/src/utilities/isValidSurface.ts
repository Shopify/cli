import type {Surface} from '../ExtensionServerClient';

const AVAILABLE_SURFACES = ['admin', 'checkout', 'post-checkout'];

export function isValidSurface(surface: any): surface is Surface {
  return surface && AVAILABLE_SURFACES.includes(surface);
}
