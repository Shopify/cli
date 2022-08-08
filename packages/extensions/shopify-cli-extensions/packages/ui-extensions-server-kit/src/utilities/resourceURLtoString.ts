import type {ResourceURL} from '../types';

export function resourceURLtoString(resource: ResourceURL) {
  const url = new URL(resource.url);
  url.searchParams.set('lastUpdated', String(resource.lastUpdated));
  return url.toString();
}
