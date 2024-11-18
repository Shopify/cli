import {Alert, AlertProps} from './components/Alert.js'
import {renderOnce} from '../ui.js'
import {consoleError, consoleLog, consoleWarn, Logger, LogLevel} from '../../../public/node/output.js'
import React from 'react'
import {RenderOptions} from 'ink'

const typeToLogLevel: {[key in AlertProps['type']]: LogLevel} = {
  info: 'info',
  warning: 'warn',
  success: 'info',
  error: 'error',
}

const typeToLogger: {[key in AlertProps['type']]: Logger} = {
  info: consoleLog,
  warning: consoleWarn,
  success: consoleLog,
  error: consoleError,
}

export interface AlertOptions extends AlertProps {
  renderOptions?: RenderOptions
}

export function alert({
  type,
  headline,
  body,
  nextSteps,
  reference,
  link,
  customSections,
  orderedNextSteps = false,
  renderOptions,
}: AlertOptions) {
  // eslint-disable-next-line prefer-rest-params
  const {type: alertType, ..._eventProps} = arguments[0]

  return renderOnce(
    <Alert
      type={type}
      headline={headline}
      body={body}
      nextSteps={nextSteps}
      reference={reference}
      link={link}
      orderedNextSteps={orderedNextSteps}
      customSections={customSections}
    />,
    {logLevel: typeToLogLevel[type], logger: typeToLogger[type], renderOptions},
  )
}
