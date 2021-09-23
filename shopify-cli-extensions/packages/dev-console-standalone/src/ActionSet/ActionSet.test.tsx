import React from 'react';
import {
  RefreshMinor,
  ViewMinor,
  HideMinor,
  CircleAlertMajor,
} from '@shopify/polaris-icons';
import {Icon, Popover} from '@shopify/polaris';
import QRCode from 'qrcode.react';
import {mockExtensions} from '@shopify/ui-extensions-dev-console/testing';

import {mount} from 'tests/mount';

import {ToastProvider} from '@/hooks/useToast';
import {Action} from './Action';
import {ActionSet} from './ActionSet';

jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

const defaultExtension = mockExtensions()[0];

describe('ActionSet', () => {
  function Wrapper({children}: React.PropsWithChildren<{}>) {
    return (
      <ToastProvider>
        <table>
          <tbody>
            <tr>
              {children}
            </tr>
          </tbody>
        </table>
      </ToastProvider>
    );
  }

  it('calls refresh with given extension when refresh button is clicked', async () => {
    const container = await mount(
      <Wrapper><ActionSet extension={defaultExtension} /></Wrapper>,
    );

    container.find(Action, {source: RefreshMinor})?.trigger('onAction');

    // refresh
    expect(container.context.console.send).toHaveBeenCalledWith([defaultExtension]);
  });

  it('calls show with given extension when show button is clicked', async () => {
    const extension = {
      ...defaultExtension,
      hidden: true,
    };

    const container = await mount(
      <Wrapper><ActionSet extension={extension} /></Wrapper>,
    );

    container.find(Action, {source: HideMinor})?.trigger('onAction');

    expect(container.context.console.send).toHaveBeenCalledWith([extension]);
  });

  it('calls hide with given extension when hide button is clicked', async () => {
    const extension = {
      ...defaultExtension,
      hidden: false,
    };

    const container = await mount(
      <Wrapper><ActionSet extension={extension} /></Wrapper>
    );

    container.find(Action, {source: ViewMinor})?.trigger('onAction');

    expect(container.context.console.send).toHaveBeenCalledWith([extension]);
  });

  it('renders QRCode with mobile deep-link url', async () => {
    const container = await mount(
      <Wrapper><ActionSet activeMobileQRCode extension={defaultExtension} /></Wrapper>,
    );

    await container.find(Popover)?.find(Action)?.trigger('onAction');

    const qrCodeElement = container?.find(QRCode);

    expect(qrCodeElement?.prop('value')).toStrictEqual(
      'https://shop1.myshopify.io/admin/extensions-dev/mobile',
    );
  });

  it('renders error popover when failing to generate mobile QR code', async () => {
    const container = await mount(
      <Wrapper><ActionSet activeMobileQRCode extension={defaultExtension} /></Wrapper>,
    );

    await container.find(Popover)?.find(Action)?.trigger('onAction');

    expect(container).toContainReactComponent(Icon, {
      source: CircleAlertMajor,
      color: 'subdued',
    });
  });
});
