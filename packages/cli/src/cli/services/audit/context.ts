import {cwd} from '@shopify/cli-kit/node/path'
import type {AuditContext, ThemeAuditOptions} from './types.js'

export function createAuditContext(options: ThemeAuditOptions): AuditContext {
  return {
    workingDirectory: options.path ?? cwd(),
    environment: options.environment,
    store: options.store,
    password: options.password,
    data: {},
  }
}
