import {AbortSignal} from '@shopify/cli-kit/node/abort'

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
