import {themePreviewJsonOutputSchema, type ThemePreviewResult} from './types.js'

export function encodeThemePreviewResult(result: ThemePreviewResult): string {
  return themePreviewJsonOutputSchema.encode(result)
}
