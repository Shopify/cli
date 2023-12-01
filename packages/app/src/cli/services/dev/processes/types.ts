import type {AbortSignal} from '@shopify/cli-kit/node/abort'
import type {AdminSession} from '@shopify/cli-kit/node/session'

import {Writable} from 'node:stream'

export type DevProcessFunction<TOptions = unknown> = (
  context: {stdout: Writable; stderr: Writable; abortSignal: AbortSignal},
  options: TOptions,
) => Promise<void>

export interface BaseProcess<T> {
  prefix: string
  function: DevProcessFunction<T>
  options: T
}

export interface PreviewThemeAppExtensionsOptions {
  adminSession: AdminSession
  themeExtensionServerArgs: string[]
  storefrontToken: string
  token: string
}

export interface PreviewThemeAppExtensionsProcess extends BaseProcess<PreviewThemeAppExtensionsOptions> {
  type: 'theme-app-extensions'
}
