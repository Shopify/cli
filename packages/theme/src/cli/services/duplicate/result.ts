import {themeDuplicateJsonOutputSchema, type ThemeDuplicateResult, type ThemeDuplicateJsonResult} from './types.js'
import {themeComponent} from '../../utilities/theme-ui.js'
import {renderError, renderSuccess} from '@shopify/cli-kit/node/ui'
import {outputResult} from '@shopify/cli-kit/node/output'
import {AbortError} from '@shopify/cli-kit/node/error'

export function themeDuplicateJsonResult(result: ThemeDuplicateResult) {
  if (result.status === 'cancelled') return {status: 'cancelled' as const}
  const json = toJsonResult(result)
  if (json.status === 'failed') {
    const error = new AbortError(json.message.trim())
    error.details = {errors: json.errors, ...(json.requestId ? {requestId: json.requestId} : {})}
    throw error
  }
  return json
}

export function renderThemeDuplicateResult(result: ThemeDuplicateResult, format: 'text' | 'json'): void {
  if (format === 'json') {
    outputResult(themeDuplicateJsonOutputSchema.encode(themeDuplicateJsonResult(result)))
    return
  }
  if (result.status === 'cancelled') return
  const json = toJsonResult(result)
  if (result.status === 'completed') renderTextResult(result)
  else if ('message' in json) renderError({body: [json.message]})
}

function toJsonResult(result: Exclude<ThemeDuplicateResult, {status: 'cancelled'}>): ThemeDuplicateJsonResult {
  switch (result.status) {
    case 'missing-theme-id':
      return {
        status: 'failed',
        message: 'A theme ID is required to duplicate a theme, specify one with the --theme flag',
        errors: [],
      }
    case 'not-found':
      return {
        status: 'failed',
        message: `No theme with ID ${result.themeId} could be found. Use shopify theme list to find a theme ID.`,
        errors: [],
      }
    case 'development-theme':
      return {
        status: 'failed',
        message: "Development themes can't be duplicated. Use shopify theme push to upload it to the store first.",
        errors: [],
      }
    case 'completed': {
      if (result.userErrors.length > 0) {
        return {
          status: 'failed',
          message: `The theme '${result.originalTheme.name}' could not be duplicated due to errors`,
          errors: result.userErrors.map((error) => error.message),
          requestId: result.requestId,
        }
      }
      if (result.theme) {
        const {id, name, role} = result.theme
        return {
          status: 'success',
          originalTheme: result.originalTheme,
          theme: {id, name, role, shop: result.shop, preview_url: result.previewUrl},
        }
      }
      return {
        status: 'failed',
        message: `The theme '${result.originalTheme.name}' unexpectedly could not be duplicated `,
        errors: [],
        requestId: result.requestId,
      }
    }
  }
}

function renderTextResult(result: Extract<ThemeDuplicateResult, {status: 'completed'}>) {
  const theme = result.originalTheme
  if (result.userErrors && result.userErrors.length > 0) {
    const errors = result.userErrors
      .map((error: {field?: string[] | null; message: string}) => error.message)
      .join(', ')
    renderError({
      body: [
        'The theme',
        ...themeComponent(theme),
        'could not be duplicated due to errors: ',
        {subdued: errors},
        {char: '.'},
        ...(result.requestId ? ['\nRequest ID: ', {subdued: result.requestId}] : []),
      ],
    })
  } else if (result.theme) {
    renderSuccess({
      body: ['The theme', ...themeComponent(theme), 'has been duplicated', {char: '.'}],
      nextSteps: [
        [
          {
            link: {
              label: 'View the duplicated theme',
              url: result.previewUrl!,
            },
          },
        ],
      ],
    })
  } else {
    renderError({
      body: [
        'The theme',
        ...themeComponent(theme),
        'unexpectedly could not be duplicated',
        {char: '.'},
        ...(result.requestId ? ['\nRequest ID: ', {subdued: result.requestId}] : []),
      ],
    })
  }
}
