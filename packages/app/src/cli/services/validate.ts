import {type AppConfigValidateResult} from './validate/types.js'
import {AppLinkedInterface} from '../models/app/app.js'
import metadata from '../metadata.js'

async function recordValidationMetadata(valid: boolean, errors: {file: string}[]) {
  const fileCount = new Set(errors.map((error) => error.file)).size

  await metadata.addPublicMetadata(() => ({
    cmd_app_validate_valid: valid,
    cmd_app_validate_issue_count: errors.length,
    cmd_app_validate_file_count: fileCount,
  }))
}

export async function validateApp(app: AppLinkedInterface): Promise<AppConfigValidateResult> {
  const errors = app.errors?.getErrors() ?? []
  await recordValidationMetadata(errors.length === 0, errors)
  return {
    valid: errors.length === 0,
    issues: errors.map(({file, message, path, code}) => ({file, message, path, code})),
  }
}
