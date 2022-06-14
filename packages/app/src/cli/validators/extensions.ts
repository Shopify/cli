import {validateFunctionExtensions} from './extensions/functions'
import {validateUIExtensions} from './extensions/ui'
import {validateThemeExtensions} from './extensions/theme'
import {App} from '../models/app/app'

export async function validateExtensions(app: App) {
  await validateFunctionExtensions(app.extensions.function)
  await validateUIExtensions(app.extensions.ui)
  await validateThemeExtensions(app.extensions.theme)
}
