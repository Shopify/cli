import {themePreviewJsonOutputSchema, type ThemePreviewResult} from './types.js'

export function encodeThemePreviewResult(result: ThemePreviewResult): string {
  // Keep the compact wire format and key order used by the original preview command.
  return JSON.stringify(themePreviewJsonOutputSchema.validate(result))
}
