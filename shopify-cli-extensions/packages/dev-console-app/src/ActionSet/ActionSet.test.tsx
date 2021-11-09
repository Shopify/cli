import React from 'react';
import {Popover} from '@shopify/polaris';
import QRCode from 'qrcode.react';
import {mockApp, mockExtension, mockExtensions} from '@shopify/ui-extensions-server-kit/testing';
import {ExtensionServerClient} from '@shopify/ui-extensions-server-kit';
import {render, withProviders} from '@shopify/shopify-cli-extensions-test-utils';
import {ToastProvider} from '@/hooks/useToast';
import {mockI18n} from 'tests/mock-i18n';
import {DefaultProviders} from 'tests/DefaultProviders';

import en from './translations/en.json';
import {Action} from './Action';
import {ActionSet} from './ActionSet';

jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

const i18n = mockI18n(en);

describe('ActionSet', () => {
  function TableWrapper({children}: React.PropsWithChildren<{}>) {
    return (
      <table>
        <tbody>
          <tr>{children}</tr>
        </tbody>
      </table>
    );
  }

  it('calls refresh with given extension when refresh button is clicked', async () => {
    const extension = mockExtension();
    const client = new ExtensionServerClient({connection: {url: 'ws://localhost'}});
    const sendSpy = jest.spyOn(client.connection, 'send').mockImplementation();
    const container = render(
      <ActionSet extension={extension} />,
      withProviders(DefaultProviders, ToastProvider, TableWrapper),
      {client},
    );

    container.find(Action, {accessibilityLabel: i18n.translate('refresh')})?.trigger('onAction');

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'dispatch',
        data: {type: 'refresh', payload: [{uuid: extension.uuid}]},
      }),
    );
  });

  it('calls show with given extension when show button is clicked', async () => {
    const extension = mockExtension({development: {hidden: true}});
    const client = new ExtensionServerClient({connection: {url: 'ws://localhost'}});
    const sendSpy = jest.spyOn(client.connection, 'send').mockImplementation();
    const container = render(
      <ActionSet extension={extension} />,
      withProviders(DefaultProviders, ToastProvider, TableWrapper),
      {client},
    );

    container.find(Action, {accessibilityLabel: i18n.translate('show')})?.trigger('onAction');

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'update',
        data: {extensions: [{uuid: extension.uuid, development: {hidden: false}}]},
      }),
    );
  });

  it('calls hide with given extension when hide button is clicked', async () => {
    const extension = mockExtension({development: {hidden: false}});
    const client = new ExtensionServerClient({connection: {url: 'ws://localhost'}});
    const sendSpy = jest.spyOn(client.connection, 'send').mockImplementation();
    const container = render(
      <ActionSet extension={extension} />,
      withProviders(DefaultProviders, ToastProvider, TableWrapper),
      {client},
    );

    container.find(Action, {accessibilityLabel: i18n.translate('hide')})?.trigger('onAction');

    expect(sendSpy).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'update',
        data: {extensions: [{uuid: extension.uuid, development: {hidden: true}}]},
      }),
    );
  });

  it('renders QRCode with mobile deep-link url', async () => {
    const app = mockApp();
    const store = 'example.com';
    const extension = mockExtension();
    const container = render(
      <ActionSet activeMobileQRCode extension={extension} />,
      withProviders(DefaultProviders, ToastProvider, TableWrapper),
      {state: {app, store, extensions: [extension]}},
    );

    container.find(Popover)?.find(Action)?.trigger('onAction');

    expect(container?.find(QRCode)?.prop('value')).toStrictEqual(
      `https://example.com/admin/extensions-dev/mobile?url=${extension.development.root.url}`,
    );
  });

  it('renders error popover when failing to generate mobile QR code', async () => {
    const store = 'example.com';
    const extension = mockExtension();
    const container = render(
      <ActionSet activeMobileQRCode extension={extension} />,
      withProviders(DefaultProviders, ToastProvider, TableWrapper),
      {state: {store, extensions: [extension]}},
    );

    container
      .find(Action, {accessibilityLabel: i18n.translate('qrcode.action')})
      ?.trigger('onAction');

    expect(container).toContainReactComponent('p', {
      children: i18n.translate('qrcode.loadError'),
    });
  });

  it('renders error popover when server is unsecure', async () => {
    const store = 'example.com';
    const extension = mockExtension();
    extension.development.root.url = extension.development.root.url.replace(
      'https://secure-link.com',
      'http://localhost',
    );
    const container = render(
      <ActionSet activeMobileQRCode extension={extension} />,
      withProviders(DefaultProviders, ToastProvider, TableWrapper),
      {state: {store, extensions: [extension]}},
    );

    container
      .find(Action, {accessibilityLabel: i18n.translate('qrcode.action')})
      ?.trigger('onAction');

    expect(container).toContainReactComponent('p', {
      children: i18n.translate('qrcode.useSecureURL'),
    });
  });
});
