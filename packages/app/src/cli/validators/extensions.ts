import {validateFunctionExtensions} from './extensions/functions.js'
import {validateThemeExtensions} from './extensions/theme.js'
import {AppInterface} from '../models/app/app.js'

export async function validateExtensions(app: AppInterface) {
  await Promise.all([
    validateFunctionExtensions(app.extensions.function),
    app.extensions.ui.forEach((ext) => ext.validate()),
    validateThemeExtensions(app.extensions.theme),
  ])
}
