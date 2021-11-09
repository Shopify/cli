import WS from 'jest-websocket-mock';
import {renderHook, withProviders} from '@shopify/shopify-cli-extensions-test-utils';

import {mockApp, mockExtension} from '../testing';
import {useExtensionServerContext} from '../hooks';
import {createConnectedAction} from '../state';

import {ExtensionServerProvider} from './ExtensionServerProvider';

describe('ExtensionServerProvider tests', () => {
  describe('client tests', () => {
    it('creates a new ExtensionServerClient instance', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}};

      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {options},
      );

      expect(wrapper.result.client).toBeDefined();
    });

    it('does not start a new connection if an empty url is passed', async () => {
      const options = {connection: {url: ''}};

      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {options},
      );

      expect(wrapper.result.client!.connection).toBeUndefined();
    });
  });

  describe('connect tests', () => {
    it('starts a new connection by calling connect', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}};
      const socket = new WS(options.connection.url, {jsonProtocol: true});
      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {
          options: {
            connection: {url: ''},
          },
        },
      );

      expect(socket.server.clients()).toHaveLength(0);

      wrapper.act(({connect}) => connect(options));

      expect(wrapper.result.client!.connection).toBeDefined();
      expect(socket.server.clients()).toHaveLength(1);
      socket.close();
    });
  });

  describe('dispatch tests', () => {
    it('updates the state', async () => {
      const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}};
      const app = mockApp();
      const extension = mockExtension();
      const payload = {app, extensions: [extension], store: 'test-store.com'};
      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {options},
      );

      wrapper.act(({dispatch}) => {
        dispatch({type: 'connected', payload});
      });

      expect(wrapper.result.state).toStrictEqual({
        app,
        extensions: [extension],
        store: 'test-store.com',
      });
    });
  });

  describe('state tests', () => {
    let socket: WS;
    const options = {connection: {url: 'ws://example-host.com:8000/extensions/'}};

    beforeEach(() => {
      socket = new WS(options.connection.url, {jsonProtocol: true});
    });

    afterEach(() => {
      socket.close();
    });

    it('persists connection data to the state', async () => {
      const app = mockApp();
      const extension = mockExtension();
      const data = {app, store: 'test-store.com', extensions: [extension]};
      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {options},
      );

      wrapper.act(() => socket.send({event: 'connected', data}));

      expect(wrapper.result.state).toStrictEqual({
        app,
        extensions: [extension],
        store: 'test-store.com',
      });
    });

    it('persists update data to the state', async () => {
      const app = mockApp();
      const extension = mockExtension();
      const update = {...extension, version: 'v2'};
      const data = {app, store: 'test-store.com', extensions: [extension]};
      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {options},
      );

      wrapper.act(({dispatch}) => {
        dispatch(createConnectedAction(data));

        socket.send({event: 'update', data: {...data, extensions: [update]}});
      });

      expect(wrapper.result.state).toStrictEqual({
        app,
        extensions: [update],
        store: 'test-store.com',
      });
    });

    it('persists refresh data to the state', async () => {
      const app = mockApp();
      const extension = mockExtension();
      const data = {app, store: 'test-store.com', extensions: [extension]};
      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {options},
      );

      wrapper.act(({dispatch}) => {
        dispatch(createConnectedAction(data));

        socket.send({
          event: 'dispatch',
          data: {type: 'refresh', payload: [{uuid: extension.uuid}]},
        });
      });

      const [updatedExtension] = wrapper.result.state.extensions;
      expect(updatedExtension.assets.main.url).not.toBe(extension.assets.main.url);
    });

    it('persists focus data to the state', async () => {
      const app = mockApp();
      const extension = mockExtension();
      const data = {app, store: 'test-store.com', extensions: [extension]};
      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {options},
      );

      wrapper.act(({dispatch}) => {
        dispatch(createConnectedAction(data));

        socket.send({
          event: 'dispatch',
          data: {type: 'focus', payload: [{uuid: extension.uuid}]},
        });
      });

      const [updatedExtension] = wrapper.result.state.extensions;
      expect(updatedExtension.development.focused).toBe(true);
    });

    it('persists unfocus data to the state', async () => {
      const app = mockApp();
      const extension = mockExtension();
      extension.development.focused = true;
      const data = {app, store: 'test-store.com', extensions: [extension]};
      const wrapper = renderHook(
        useExtensionServerContext,
        withProviders(ExtensionServerProvider),
        {options},
      );

      wrapper.act(({dispatch}) => {
        dispatch(createConnectedAction(data));

        socket.send({
          event: 'dispatch',
          data: {type: 'unfocus'},
        });
      });

      const [updatedExtension] = wrapper.result.state.extensions;
      expect(updatedExtension.development.focused).toBe(false);
    });
  });
});
