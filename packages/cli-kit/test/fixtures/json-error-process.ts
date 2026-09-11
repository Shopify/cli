import {AbortError, handler} from '../../src/public/node/error.js'
import {outputInfo} from '../../src/public/node/output.js'

outputInfo('Recoverable diagnostic')
await handler(
  new AbortError(
    'Expected failure',
    ['Run', {command: 'shopify app dev'}, 'again.'],
    [['Read', {link: {label: 'the documentation', url: 'https://shopify.dev'}}, {char: '.'}]],
    [{title: 'Details', body: 'The app could not be loaded.'}],
  ),
)
process.exitCode = 2
