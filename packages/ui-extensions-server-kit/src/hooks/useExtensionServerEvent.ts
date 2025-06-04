import {useExtensionServerContext} from './useExtensionServerContext'
import {useIsomorphicLayoutEffect} from './useIsomorphicLayoutEffect'

export function useExtensionServerEvent<TEvent extends keyof ExtensionServer.InboundEvents>(
  event: TEvent,
  listener: ExtensionServer.EventListener<TEvent>,
): void {
  const {client} = useExtensionServerContext()

  useIsomorphicLayoutEffect(() => client.on(event, listener), [client, event, listener])
}
