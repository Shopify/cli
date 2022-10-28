import {ExtensionServerClient} from '../ExtensionServerClient/index.js'
import {INITIAL_STATE} from '../state/index.js'
import {noop} from '../utilities/index.js'
import {createContext} from 'react'

import type {ExtensionServerContext} from './types'

export const DEFAULT_VALUE: ExtensionServerContext = {
  connect: noop,
  dispatch: noop,
  state: INITIAL_STATE,
  client: new ExtensionServerClient(),
}

export const extensionServerContext = createContext<ExtensionServerContext>(DEFAULT_VALUE)
