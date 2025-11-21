import {Response} from 'node-fetch'

export function convertRequestToParams(queryParams: {client_id: string; scope: string}): string {
  return Object.entries(queryParams)
    .map(([key, value]) => value && `${key}=${value}`)
    .filter((hasValue) => Boolean(hasValue))
    .join('&')
}

/**
 * Build a detailed error message for JSON parsing failures from the authorization service.
 * Provides context-specific error messages based on response status and content.
 *
 * @param response - The HTTP response object
 * @param responseText - The raw response body text
 * @returns Detailed error message about the failure
 */
export function buildAuthorizationParseErrorMessage(response: Response, responseText: string): string {
  // Build helpful error message based on response status and content
  let errorMessage = `Received invalid response from authorization service (HTTP ${response.status}).`

  // Add status-based context
  if (response.status >= 500) {
    errorMessage += ' The service may be experiencing issues.'
  } else if (response.status >= 400) {
    errorMessage += ' The request may be malformed or unauthorized.'
  }

  // Add content-based context (check these regardless of status)
  if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
    errorMessage += ' Received HTML instead of JSON - the service endpoint may have changed.'
  } else if (responseText.trim() === '') {
    errorMessage += ' Received empty response body.'
  } else {
    errorMessage += ' Response could not be parsed as valid JSON.'
  }

  return `${errorMessage} If this issue persists, please contact support at https://help.shopify.com`
}
