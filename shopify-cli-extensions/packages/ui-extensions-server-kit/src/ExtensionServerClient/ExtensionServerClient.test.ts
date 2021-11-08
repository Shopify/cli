import WS from 'jest-websocket-mock';

import {mockApp} from '../testing';

import {ExtensionServerClient} from './ExtensionServerClient';

describe('ExtensionServerClient', () => {
  function setup(
    options: ExtensionServer.Options = {
      connection: {url: 'ws://example-host.com:8000/extensions/'},
    },
  ) {
    if (!options.connection.url) {
      throw new Error('Please set a URL');
    }
    const socket = new WS(options.connection.url, {jsonProtocol: true});
    const client = new ExtensionServerClient(options);

    return {socket, client, options};
  }

  describe('initialization', () => {
    it('connects to the target websocket', async () => {
      const {socket, client} = setup();

      expect(client.connection).toBeDefined();
      expect(socket.server.clients()).toHaveLength(1);

      socket.close();
    });

    it('does not connect to the target websocket if "automaticConnect" is false', async () => {
      const {client, socket} = setup({
        connection: {automaticConnect: false, url: 'ws://example-host.com:8000/extensions/'},
      });

      expect(client.connection).toBeUndefined();
      expect(socket.server.clients()).toHaveLength(0);

      socket.close();
    });
  });

  describe('on()', () => {
    it('listens to persist events', async () => {
      const {socket, client} = setup();
      const updateSpy = jest.fn();
      const data = {
        app: mockApp(),
      };

      client.on('update', updateSpy);
      socket.send({event: 'update', data});

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith(data);

      socket.close();
    });

    it('unsubscribes from persist events', async () => {
      const {socket, client} = setup();
      const updateSpy = jest.fn();
      const unsubscribe = client.on('update', updateSpy);

      unsubscribe();
      socket.send({
        event: 'update',
        data: {
          app: mockApp(),
        },
      });

      expect(updateSpy).toHaveBeenCalledTimes(0);

      socket.close();
    });

    it('listens to dispatch events', async () => {
      const {socket, client} = setup();
      const unfocusSpy = jest.fn();

      client.on('unfocus', unfocusSpy);
      socket.send({event: 'dispatch', data: {type: 'unfocus'}});

      expect(unfocusSpy).toHaveBeenCalledTimes(1);
      expect(unfocusSpy).toHaveBeenCalledWith(undefined);

      socket.close();
    });
  });

  describe('emit()', () => {
    it('emits an event', async () => {
      const {socket, client} = setup();
      const data = {data: {type: 'unfocus'}, event: 'dispatch'};

      client.emit('unfocus');

      await expect(socket).toReceiveMessage(data);

      socket.close();
    });

    it('warns if trying to "emit" a persist event', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const {socket, client} = setup();

      client.emit('update' as any, {});

      expect(warnSpy).toHaveBeenCalled();

      socket.close();
      warnSpy.mockRestore();
    });
  });

  describe('persist()', () => {
    it('persists a mutation', async () => {
      const {socket, client} = setup();
      const data = {event: 'update', data: {extensions: [{uuid: '123'}]}};

      client.persist('update', {extensions: [{uuid: '123'}]});

      expect(socket).toReceiveMessage(data);

      socket.close();
    });

    it('warns if trying to "persist" a dispatch event', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const {socket, client} = setup();

      client.persist('unfocus' as any, {});

      expect(warnSpy).toHaveBeenCalled();

      socket.close();
      warnSpy.mockRestore();
    });
  });

  describe('connect()', () => {
    it.todo('updates the client options');

    it.todo('does not attempt to connect if the URL is empty');

    it.todo('does not try to connect if there is an existing active connection');

    it.todo('initializes the API client if the URL was changed');
  });
});
