import {ExtensionManifestData, Status} from '../types';

interface LocalExtensionsContextProps {
  extensions: ExtensionManifestData[];
  add(extensions: ExtensionManifestData[]): void;
  update(
    extensions: ExtensionManifestData[],
    props: Partial<ExtensionManifestData>,
  ): void;
  refresh(extensions: ExtensionManifestData[]): void;
  show(extensions: ExtensionManifestData[]): void;
  hide(extensions: ExtensionManifestData[]): void;
  remove(extensions: ExtensionManifestData[]): void;
  generateMobileQRCode(extensions: ExtensionManifestData[]): Promise<string>;
  clear(): void;
}

export function useLocalExtensions(): LocalExtensionsContextProps {
  return {
    extensions: fixture(),
    refresh: () => console.log('refresh'),
    remove: () => console.log('remove'),
    show: () => console.log('show'),
    hide: () => console.log('hide'),
    add: () => console.log('add'),
    update: () => console.log('update'),
    clear: () => console.log('clear'),
    generateMobileQRCode: () => Promise.resolve('www.example.com'),
  }
}

function fixture(): ExtensionManifestData[] {
  return [
    {
      apiKey: 'api-key',
      rendererVersion: '1.0.0',
      argoVersion: '2.0.0',
      identifier: 'identifier',
      scriptUrl: null,
      name: 'extension name',
      resourceUrl: 'www.resourceurl.com',
      uuid: 'uuid',
      stats: 'hello stats',
      mobile: 'mobile stuff',
      data: 'my data',
      app: {id: 'app-id', apiKey: 'api-key', applicationUrl: 'www.applicationurl.com', title: 'test app', icon: {transformedSrc: ''}},
      status: Status.Connected,
      focused: false,
      hidden: false,
    },
  ];
}
