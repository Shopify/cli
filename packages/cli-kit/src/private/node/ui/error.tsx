import {Fatal} from '../../../error.js'
import {Banner} from '../components/Banner.js'
import {List} from '../components/List.js'
import {renderOnce} from '../ui.js'
import {consoleError} from '../../../output.js'
import React from 'react'
import {Box, Text} from 'ink'
import {RenderErrorOptions} from '@shopify/cli-kit/node/ui'

export function fatalError(error: Fatal) {
  renderOnce(
    <Banner type="error">
      <Box marginBottom={1}>
        <Text>{error.message}</Text>
      </Box>

      {error.tryMessage && <List title="What to try" items={[error.tryMessage]} />}
    </Banner>,
    'error',
    consoleError,
  )
}

export function error({headline, tryMessages = []}: RenderErrorOptions) {
  renderOnce(
    <Banner type="error">
      <Box marginBottom={1}>
        <Text>{headline}</Text>
      </Box>

      {tryMessages.length > 0 && <List title="What to try" items={tryMessages} />}
    </Banner>,
    'error',
    consoleError,
  )
}
