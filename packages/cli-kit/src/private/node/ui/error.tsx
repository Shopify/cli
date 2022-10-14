import {ErrorProps, Error} from './components/Error.js'
import {FatalError} from './components/FatalError.js'
import {Fatal} from '../../../error.js'
import {renderOnce} from '../ui.js'
import {consoleError} from '../../../output.js'
import React from 'react'

export function fatalError(error: Fatal) {
  renderOnce(<FatalError error={error} />, 'error', consoleError)
}

export function error({headline, tryMessage}: ErrorProps) {
  renderOnce(<Error headline={headline} tryMessage={tryMessage} />, 'error', consoleError)
}
