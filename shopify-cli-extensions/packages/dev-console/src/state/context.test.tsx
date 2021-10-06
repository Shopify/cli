import React from 'react';
import {mount, Root} from '@shopify/react-testing';
import WS from 'jest-websocket-mock';

import {mockExtension, mockExtensions} from '../testing';
import {DevServerResponse, DevServerCall, ConsoleAction} from '../types';

import {Console, Listener} from './types';
import {DevConsoleProvider, useDevConsole, useListener} from './context';

function App({children, listener}: {children: (console: Console) => void; listener?: Listener}) {
  const devConsole = useDevConsole();
  children(devConsole);
  useListener((action) => listener?.(action));
  return null;
}

async function setup({listener}: {listener?: Listener} = {}) {
  const host = 'ws://example-host.com:8000/extensions/';
  const server = new WS(host);

  const ret: {
    devConsole: Console;
    server: WS;
    wrapper: Root<any>;
    destroy: () => void;
  } = {devConsole: {}} as any;

  const wrapper = await mount(
    <DevConsoleProvider host={host}>
      <App listener={listener}>
        {(_console) => {
          Object.assign(ret.devConsole, _console);
        }}
      </App>
    </DevConsoleProvider>,
  );

  wrapper.act(() => {
    server.server.emit('open', undefined);
  });

  ret.wrapper = wrapper;
  ret.server = server;
  ret.destroy = () => {
    wrapper.act(() => {
      server.close();
      server.server.close();
    });
  };

  return ret;
}

describe('useDevConsole()', () => {
  it('opens a web socket and sets initial data', async () => {
    const extensions = mockExtensions();

    const {server, wrapper, devConsole, destroy} = await setup();

    wrapper.act(() => {
      const data: DevServerResponse = {
        event: 'connected',
        data: {extensions},
      };
      server.server.emit('message', JSON.stringify(data));
    });

    expect(devConsole.extensions).toStrictEqual(extensions);

    destroy();
  });

  it('updates extension', async () => {
    const firstExtension = mockExtension();
    const extensionToUpdate = mockExtension();
    const updatedExtension = {...extensionToUpdate, version: '3.0'};

    const {server, wrapper, devConsole, destroy} = await setup();

    wrapper.act(() => {
      const connectedData: DevServerResponse = {
        event: 'connected',
        data: {extensions: [firstExtension, extensionToUpdate]},
      };
      server.server.emit('message', JSON.stringify(connectedData));

      const updateData: DevServerResponse = {
        event: 'update',
        data: {extensions: [updatedExtension]},
      };
      server.server.emit('message', JSON.stringify(updateData));
    });

    expect(devConsole.extensions).toStrictEqual([firstExtension, updatedExtension]);

    destroy();
  });

  // This test works in isolation. There's something wrong with the clean up step.
  // I suspect it's something to do with the websocket not resetting properly.
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('sends socket events', async () => {
    const {server, wrapper, devConsole, destroy} = await setup();
    const updatePayload = {uuid: '123', version: '3.0'};

    wrapper.act(async () => {
      devConsole.update({
        extensions: [updatePayload],
      });

      const expectedUpdate: DevServerCall = {
        event: 'update',
        data: {extensions: [updatePayload]},
      };
      await expect(server).toReceiveMessage(JSON.stringify(expectedUpdate));

      devConsole.dispatch({type: 'unfocus'});
      const expectedDispatch: DevServerCall = {
        event: 'dispatch',
        data: {type: 'unfocus'},
      };
      await expect(server).toReceiveMessage(JSON.stringify(expectedDispatch));
    });

    destroy();
  });

  it('listens to new dispatch events', async () => {
    let consoleAction!: ConsoleAction;
    const {server, wrapper, destroy} = await setup({
      listener: (action) => {
        consoleAction = action;
      },
    });

    wrapper.act(() => {
      const data: DevServerCall = {
        event: 'dispatch',
        data: {type: 'unfocus'},
      };
      server.server.emit('message', JSON.stringify(data));
    });

    expect(consoleAction).toStrictEqual({type: 'unfocus'});

    destroy();
  });
});
