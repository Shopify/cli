import {AbortError, handler} from '../../src/public/node/error.js'
import {Errors} from '@oclif/core'

const error = new AbortError('x'.repeat(1024 * 1024))
await handler(error)
await Errors.handle(error)
