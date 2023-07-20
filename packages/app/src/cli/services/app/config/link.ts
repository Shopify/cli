/* eslint-disable @typescript-eslint/no-explicit-any */
import {startFlow} from './utils/utils.js'
import {Config} from '@oclif/core'

export interface LinkOptions {
  commandConfig: Config
  directory: string
  apiKey?: string
  configName?: string
}

export default async function link(options: LinkOptions, shouldRenderSuccess = true): Promise<any> {
  const data = await startFlow(options)

  return {data}
}
