import type {ResourceURL} from '../types';

import {resourceURLtoString} from './resourceURLtoString';

describe('resourceURLtoString tests', () => {
  it('creates a URL string from a resource url', () => {
    const resource: ResourceURL = {
      name: 'main',
      url: 'http://localhost:8000/extensions/00000000/assets/main.js',
      lastUpdated: 1637004124,
    };

    const url = resourceURLtoString(resource);

    expect(url).toBe(`${resource.url}?lastUpdated=${resource.lastUpdated}`);
  });
});
