import {Alert, AlertProps} from './components/Alert.js'
import {renderOnce} from '../ui.js'
import {consoleLog, consoleWarn, Logger, LogLevel} from '../../../output.js'
import React from 'react'

const typeToLogLevel: {[key in AlertProps['type']]: LogLevel} = {
  info: 'info',
  warning: 'warn',
  success: 'info',
}

const typeToLogger: {[key in AlertProps['type']]: Logger} = {
  info: consoleLog,
  warning: consoleWarn,
  success: consoleLog,
}

export function alert({type, headline, body, nextSteps, reference, link, orderedNextSteps = false}: AlertProps) {
  renderOnce(
    <Alert
      type={type}
      headline={headline}
      body={body}
      nextSteps={nextSteps}
      reference={reference}
      link={link}
      orderedNextSteps={orderedNextSteps}
    />,
    typeToLogLevel[type],
    typeToLogger[type],
  )
}
