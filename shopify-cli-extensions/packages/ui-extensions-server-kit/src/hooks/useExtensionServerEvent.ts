import {useExtensionServerContext} from './useExtensionServerContext';
import {useIsomorphicLayoutEffect} from './useIsomorphicLayoutEffect';

export function useExtensionServerEvent<Event extends keyof ExtensionServer.InboundEvents>(
  event: Event,
  listener: ExtensionServer.EventListener<Event>,
): void {
  const {client} = useExtensionServerContext();

  useIsomorphicLayoutEffect(() => client?.on(event, listener), [client, event, listener]);
}
