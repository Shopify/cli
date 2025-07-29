import {expect} from 'vitest'

process.env.SHOPIFY_UNIT_TEST = '1'
process.removeAllListeners('warning')
