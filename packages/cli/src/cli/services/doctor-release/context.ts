import {cwd} from '@shopify/cli-kit/node/path'
import type {DoctorContext, ThemeDoctorOptions} from './types.js'

export function createDoctorContext(options: ThemeDoctorOptions): DoctorContext {
  return {
    workingDirectory: options.path ?? cwd(),
    environment: options.environment,
    store: options.store,
    password: options.password,
    data: {},
  }
}
