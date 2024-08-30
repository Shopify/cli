export const configurationFileName = 'shopify.theme.toml'

// This is a more performant date time format that allows us to circumvent the locale lookup
// performed in toLocaleTimeString
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleTimeString
export const timestampDateFormat = new Intl.DateTimeFormat(undefined, {
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})
