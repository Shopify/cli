import {ExtensionServerClient} from '../ExtensionServerClient'
import {INITIAL_STATE} from '../state'
import {noop} from '../utilities'
import {ExtensionServer} from '../ExtensionServerClient/server-types.js'
import {createContext} from 'react'

import type {ExtensionServerContext} from './types'

const DEFAULT_VALUE: ExtensionServerContext = {
  connect: noop,
  dispatch: noop,
  state: INITIAL_STATE,
  client: new ExtensionServerClient() as ExtensionServer.Client,
}

export const extensionServerContext = createContext<ExtensionServerContext>(DEFAULT_VALUE)
