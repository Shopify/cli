import {useExtensionServerContext} from './useExtensionServerContext'

export function useExtensionClient() {
  const {client} = useExtensionServerContext()
  return client
}
