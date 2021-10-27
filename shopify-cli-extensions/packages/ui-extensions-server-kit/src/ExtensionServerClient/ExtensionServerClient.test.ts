import WS from 'jest-websocket-mock';
import {mockApp, mockExtensions} from '../testing';

import {ExtensionServerClient} from './ExtensionServerClient';

describe('ExtensionServerClient', () => {
  async function setup(host = 'ws://example-host.com:8000/extensions/') {
    const socket = new WS(host, {jsonProtocol: true});
    const client = new ExtensionServerClient({connection: {url: host}});
    await socket.connected;

    socket.server.emit('open', undefined);

    return {socket, client, host};
  }

  describe('initialization', () => {
    it('connects to the target websocket', async () => {
      const {socket, host} = await setup();
      const {url} = await socket.connected;

      expect(url).toBe(host);

      socket.close();
    });
  });

  describe('on()', () => {
    it('listens to persist events', async () => {
      const {socket, client} = await setup();

      const updateSpy = jest.fn();
      const unsubscribe = client.on('update', updateSpy);

      const data: ExtensionServer.InboundEvents[keyof ExtensionServer.InboundEvents] = {app: mockApp()};
      socket.send({event: 'update', data});

      unsubscribe();
      socket.send({event: 'update', data});

      expect(updateSpy).toBeCalledTimes(1);
      expect(updateSpy).toBeCalledWith(data);

      socket.close();
    });

    it('listens to dispatch events', async () => {
      const {socket, client} = await setup();

      const unfocusSpy = jest.fn();
      const unsubscribe = client.on('unfocus', unfocusSpy);

      socket.send({event: 'dispatch', data: {type: 'unfocus' }});

      unsubscribe();
      socket.send({event: 'dispatch', data: {type: 'unfocus' }});

      expect(unfocusSpy).toBeCalledTimes(1);
      expect(unfocusSpy).toBeCalledWith(undefined);

      socket.close();
    });
  });

  describe('emit()', () => {
    it('emits an event', async () => {
      const {socket, client} = await setup();

      client.emit('unfocus');

      const data = {data: {type: 'unfocus'}, event: 'dispatch'};
      await expect(socket).toReceiveMessage(data);

      socket.close();
    });

    it('warns if trying to "emit" a persist event', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const {socket, client} = await setup();

      client.emit('update' as any, {});

      expect(warnSpy).toHaveBeenCalled();

      socket.close();
      warnSpy.mockRestore();
    });
  });

  describe('persist()', () => {
    it('persists a mutation', async () => {
      const {socket, client} = await setup();

      client.persist('update', {extensions: [{uuid: '123'}]});

      const data = {event: 'update', data: {extensions: [{uuid: '123'}]}};
      expect(socket).toReceiveMessage(data);

      socket.close();
    });

    it.todo('warns if trying to "persist" a dispatch event');
  });
});
