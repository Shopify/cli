import {validateFunctionExtensions} from './extensions/functions'
import {validateUIExtensions} from './extensions/ui'
import {validateThemeExtensions} from './extensions/theme'
import {App} from '../models/app/app'

export async function validateExtensions(app: App) {
  await Promise.all([
    validateFunctionExtensions(app.extensions.function),
    validateUIExtensions(app.extensions.ui),
    validateThemeExtensions(app.extensions.theme),
  ])
}
