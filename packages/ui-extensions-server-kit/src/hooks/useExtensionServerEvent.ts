import {useExtensionServerContext} from './useExtensionServerContext.js'
import {useIsomorphicLayoutEffect} from './useIsomorphicLayoutEffect.js'

export function useExtensionServerEvent<TEvent extends keyof ExtensionServer.InboundEvents>(
  event: TEvent,
  listener: ExtensionServer.EventListener<TEvent>,
): void {
  const {client} = useExtensionServerContext()

  useIsomorphicLayoutEffect(() => client.on(event, listener), [client, event, listener])
}
