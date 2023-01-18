import {App} from '../types'

export function mockApp(): App {
  return {
    id: 'id-1',
    apiKey: '12345',
    applicationUrl: 'www.applicationUrl.com',
    title: 'App title',
    url: 'mock url',
    mobileUrl: 'mock mobile url',
    icon: {
      transformedSrc: 'www.transformed-src.com',
    },
  }
}
