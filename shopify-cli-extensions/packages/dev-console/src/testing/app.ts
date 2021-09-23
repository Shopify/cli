import {App} from '../types';

export function mockApp(): App {
  return {
    id: 'id-1',
    apiKey: '12345',
    applicationUrl: 'www.applicationUrl.com',
    title: 'App title',
    icon: {
      transformedSrc: 'www.transformed-src.com',
    },
  }
};
