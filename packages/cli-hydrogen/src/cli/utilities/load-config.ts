import {createRequire} from 'module'
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-ignore
import type {HydrogenConfig} from '@shopify/hydrogen/config'
/* eslint-enable @typescript-eslint/ban-ts-comment */

const require = createRequire(import.meta.url)
const {loadConfig} = require('@shopify/hydrogen/load-config') as {
  loadConfig: (options: {root: string}) => Promise<HydrogenConfig>
}

export {loadConfig}
