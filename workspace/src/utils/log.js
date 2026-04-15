const colors = {
  green: {bold: (string) => `\x1b[1m\x1b[32m${string}\x1b[39m\x1b[22m`},
  gray: (string) => `\x1b[90m${string}\x1b[39m`,
}

export function logSection(title) {
  console.info(colors.green.bold(title))
}

export function logMessage(message) {
  console.info(colors.gray(`  ${message}`))
}
