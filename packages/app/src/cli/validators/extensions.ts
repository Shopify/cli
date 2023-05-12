import {validateFunctionExtensions} from './extensions/functions.js'
import {validateUIExtensions} from './extensions/ui.js'
import {validateThemeExtensions} from './extensions/theme.js'
import {AppInterface} from '../models/app/app.js'

export async function validateExtensions(app: AppInterface) {
  await Promise.all([
    validateFunctionExtensions(app.legacyExtensions.function),
    validateUIExtensions(app.legacyExtensions.ui),
    validateThemeExtensions(app.legacyExtensions.theme),
  ])
}
