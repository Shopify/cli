import React from 'react';
import {Popover} from '@shopify/polaris';
import QRCode from 'qrcode.react';
import {mockExtension, mockExtensions} from '@shopify/ui-extensions-dev-console/testing';
import {mount} from 'tests/mount';
import {ToastProvider} from '@/hooks/useToast';
import {mockI18n} from 'tests/mock-i18n';

import en from './translations/en.json';
import {Action} from './Action';
import {ActionSet} from './ActionSet';

jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

const i18n = mockI18n(en);

describe('ActionSet', () => {
  function Wrapper({children}: React.PropsWithChildren<{}>) {
    return (
      <ToastProvider>
        <table>
          <tbody>
            <tr>{children}</tr>
          </tbody>
        </table>
      </ToastProvider>
    );
  }

  it('calls refresh with given extension when refresh button is clicked', async () => {
    const extension = mockExtension();

    const container = await mount(
      <Wrapper>
        <ActionSet extension={extension} />
      </Wrapper>,
    );

    container.find(Action, {accessibilityLabel: i18n.translate('refresh')})?.trigger('onAction');

    expect(container.context.console.send).toHaveBeenCalledWith({
      data: {payload: [extension.uuid], type: 'refresh'},
      event: 'dispatch',
    });
  });

  it('calls show with given extension when show button is clicked', async () => {
    const extension = mockExtension({development: {hidden: true}});

    const container = await mount(
      <Wrapper>
        <ActionSet extension={extension} />
      </Wrapper>,
    );

    container.find(Action, {accessibilityLabel: i18n.translate('show')})?.trigger('onAction');

    expect(container.context.console.send).toHaveBeenCalledWith({
      data: {extensions: [{development: {hidden: false}, uuid: extension.uuid}]},
      event: 'update',
    });
  });

  it('calls hide with given extension when hide button is clicked', async () => {
    const extension = mockExtension({development: {hidden: false}});

    const container = await mount(
      <Wrapper>
        <ActionSet extension={extension} />
      </Wrapper>,
    );

    container.find(Action, {accessibilityLabel: i18n.translate('hide')})?.trigger('onAction');

    expect(container.context.console.send).toHaveBeenCalledWith({
      data: {extensions: [{development: {hidden: true}, uuid: extension.uuid}]},
      event: 'update',
    });
  });

  it('renders QRCode with mobile deep-link url', async () => {
    const host = 'www.example-host.com:8000/extensions/';
    const extension = mockExtension();

    const container = await mount(
      <Wrapper>
        <ActionSet activeMobileQRCode extension={extension} />
      </Wrapper>,
      {console: {host}},
    );

    await container.find(Popover)?.find(Action)?.trigger('onAction');

    const qrCodeElement = container?.find(QRCode);

    expect(qrCodeElement?.prop('value')).toStrictEqual(host);
  });

  it('renders error popover when failing to generate mobile QR code', async () => {
    const container = await mount(
      <Wrapper>
        <ActionSet activeMobileQRCode extension={mockExtension()} />
      </Wrapper>,
      // skip app mock
      {console: {state: {extensions: mockExtensions()}}},
    );

    await container
      .find(Action, {accessibilityLabel: i18n.translate('qrcode.action')})
      ?.trigger('onAction');

    expect(container).toContainReactComponent('p', {
      children: i18n.translate('qrcode.loadError'),
    });
  });
});
