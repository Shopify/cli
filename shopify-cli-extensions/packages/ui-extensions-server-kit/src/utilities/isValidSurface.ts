import type {Surface} from '../ExtensionServerClient';

export function isValidSurface(surface: any): surface is Surface {
  return (surface && surface === 'admin') || surface === 'checkout' || surface === 'post-purchase';
}
