export function logSection(title) {
  console.info(`\x1b[1m\x1b[32m${title}\x1b[39m\x1b[22m`)
}

export function logMessage(message) {
  console.info(`\x1b[90m  ${message}\x1b[39m`)
}
