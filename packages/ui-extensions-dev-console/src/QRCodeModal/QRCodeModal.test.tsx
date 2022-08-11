import React from 'react';
import QRCode from 'qrcode.react';
import {mockApp, mockExtension} from '@shopify/ui-extensions-server-kit/testing';
import {render, withProviders} from '@shopify/ui-extensions-test-utils';
import {ToastProvider} from '@/hooks/useToast';
import {mockI18n} from 'tests/mock-i18n';
import {DefaultProviders} from 'tests/DefaultProviders';

import en from './translations/en.json';
import {QRCodeModal} from './QRCodeModal';

jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

const i18n = mockI18n(en);

describe('QRCodeModal', () => {
  it('does not render QRCode if extension is not provided', async () => {
    const app = mockApp();
    const store = 'example.com';
    const extension = mockExtension();
    const container = render(
      <QRCodeModal onClose={jest.fn()} open />,
      withProviders(DefaultProviders, ToastProvider),
      {state: {app, store, extensions: [extension]}},
    );

    expect(container).not.toContainReactComponent(QRCode);
  });

  it('renders QRCode with mobile deep-link url', async () => {
    const app = mockApp();
    const store = 'example.com';
    const extension = mockExtension();
    const container = render(
      <QRCodeModal extension={extension} onClose={jest.fn()} open />,
      withProviders(DefaultProviders, ToastProvider),
      {state: {app, store, extensions: [extension]}},
    );

    expect(container?.find(QRCode)?.prop('value')).toStrictEqual(
      `https://example.com/admin/extensions-dev/mobile?url=${extension.development.root.url}`,
    );
  });

  it('renders error message when server is unsecure', async () => {
    const store = 'example.com';
    const extension = mockExtension();
    extension.development.root.url = extension.development.root.url.replace(
      'https://secure-link.com',
      'http://localhost',
    );

    const container = render(
      <QRCodeModal extension={extension} onClose={jest.fn()} open />,
      withProviders(DefaultProviders, ToastProvider),
      {state: {store, extensions: [extension]}},
    );

    expect(container).toContainReactComponent('p', {
      children: i18n.translate('qrcode.useSecureURL'),
    });
  });

  it('renders QRCode with pos deep-link url when surface is POS', async () => {
    const app = mockApp();
    const store = 'example.com';
    const extension = mockExtension({surface: 'pos'});
    const container = render(
      <QRCodeModal extension={extension} onClose={jest.fn()} open />,
      withProviders(DefaultProviders, ToastProvider),
      {state: {app, store, extensions: [extension]}},
    );

    expect(container?.find(QRCode)?.prop('value')).toStrictEqual(
      `com.shopify.pos://pos-ui-extensions?url=${extension.development.root.url}`,
    );
  });
});
