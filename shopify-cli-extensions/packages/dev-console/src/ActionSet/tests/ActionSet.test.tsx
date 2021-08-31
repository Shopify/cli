import React from 'react';
import {
  RefreshMinor,
  ViewMinor,
  HideMinor,
  DeleteMinor,
  CircleAlertMajor,
} from '@shopify/polaris-icons';
import {Icon, Popover} from '@shopify/polaris';
import QRCode from 'qrcode.react';

import {mount} from 'tests/mount';

import {ToastProvider} from 'hooks/useToast';
import {Action} from '../Action';
import {ActionSet} from '../ActionSet';

const mockApp = {
  id: 'mock',
  apiKey: 'mock',
  applicationUrl: 'mock',
  title: 'mock',
  icon: {
    transformedSrc: 'mock',
  },
};

jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

const mockExtensions = jest.fn();

jest.mock('components/Extensions', () => ({
  ...jest.requireActual('components/Extensions'),
  useLocalExtensions() {
    return mockExtensions();
  },
}));

jest.mock('@web-utilities/shop', () => ({
  ...jest.requireActual('@web-utilities/shop'),
  useShop() {
    return {
      shopDomain: 'shop1.myshopify.io',
    };
  },
}));

const defaultExtension = {
  apiKey: 'asdf123',
  extensionId: 12345,
  identifier: 'TYPE',
  scriptUrl: 'https://u.rl/data',
  name: 'Excellent extension',
  app: mockApp,
  stats: 'https://myshopify.io/stats',
  data: 'https://myshopify.io/stats',
  mobile: 'https://myshopify.io/mobile',
  uuid: '12345',
  rendererVersion: '0.10.0',
};

describe('ActionSet', () => {
  it('calls refresh with given extension when refresh button is clicked', async () => {
    const refresh = jest.fn();

    mockExtensions.mockReturnValue({
      refresh,
    });

    const container = await mount(
      <ToastProvider>
        <table>
          <tbody>
            <tr>
              <ActionSet extension={defaultExtension} />
            </tr>
          </tbody>
        </table>
      </ToastProvider>,
    );

    container.find(Action, {source: RefreshMinor})?.trigger('onAction');

    expect(refresh).toHaveBeenCalledWith([defaultExtension]);
  });

  it('calls remove with given extension when remove button is clicked', async () => {
    const remove = jest.fn();

    mockExtensions.mockReturnValue({
      remove,
    });

    const container = await mount(
      <ToastProvider>
        <table>
          <tbody>
            <tr>
              <ActionSet extension={defaultExtension} />
            </tr>
          </tbody>
        </table>
      </ToastProvider>,
    );

    container.find(Action, {source: DeleteMinor})?.trigger('onAction');

    expect(remove).toHaveBeenCalledWith([defaultExtension]);
  });

  it('calls show with given extension when show button is clicked', async () => {
    const extension = {
      ...defaultExtension,
      hidden: true,
    };

    const show = jest.fn();

    mockExtensions.mockReturnValue({
      show,
      hide: jest.fn(),
    });

    const container = await mount(
      <ToastProvider>
        <table>
          <tbody>
            <tr>
              <ActionSet extension={extension} />
            </tr>
          </tbody>
        </table>
      </ToastProvider>,
    );

    container.find(Action, {source: HideMinor})?.trigger('onAction');

    expect(show).toHaveBeenCalledWith([extension]);
  });

  it('calls hide with given extension when hide button is clicked', async () => {
    const extension = {
      ...defaultExtension,
      hidden: false,
    };

    const hide = jest.fn();

    mockExtensions.mockReturnValue({
      hide,
      show: jest.fn(),
    });

    const container = await mount(
      <ToastProvider>
        <table>
          <tbody>
            <tr>
              <ActionSet extension={extension} />
            </tr>
          </tbody>
        </table>
      </ToastProvider>,
    );

    container.find(Action, {source: ViewMinor})?.trigger('onAction');

    expect(hide).toHaveBeenCalledWith([extension]);
  });

  it('renders QRCode with mobile deep-link url', async () => {
    const generateMobileQRCode = jest.fn();
    generateMobileQRCode.mockReturnValue(
      'https://shop1.myshopify.io/admin/extensions-dev/mobile',
    );

    mockExtensions.mockReturnValue({
      generateMobileQRCode,
    });

    const container = await mount(
      <ToastProvider>
        <table>
          <tbody>
            <tr>
              <ActionSet activeMobileQRCode extension={defaultExtension} />
            </tr>
          </tbody>
        </table>
      </ToastProvider>,
    );

    await container.find(Popover)?.find(Action)?.trigger('onAction');

    const qrCodeElement = container?.find(QRCode);

    expect(qrCodeElement?.prop('value')).toStrictEqual(
      'https://shop1.myshopify.io/admin/extensions-dev/mobile',
    );
  });

  it('renders error popover when failing to generate mobile QR code', async () => {
    const generateMobileQRCode = jest.fn(() => {
      throw new Error('dummy error');
    });
    mockExtensions.mockReturnValue({
      generateMobileQRCode,
    });

    const container = await mount(
      <ToastProvider>
        <table>
          <tbody>
            <tr>
              <ActionSet activeMobileQRCode extension={defaultExtension} />
            </tr>
          </tbody>
        </table>
      </ToastProvider>,
    );

    await container.find(Popover)?.find(Action)?.trigger('onAction');

    expect(container).toContainReactComponent(Icon, {
      source: CircleAlertMajor,
      color: 'subdued',
    });
  });
});
