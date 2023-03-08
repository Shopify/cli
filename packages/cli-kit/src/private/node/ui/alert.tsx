import {Alert, AlertProps} from './components/Alert.js'
import {renderOnce} from '../ui.js'
import {consoleLog, consoleWarn, Logger, LogLevel} from '../../../public/node/output.js'
import React from 'react'
import {RenderOptions} from 'ink'

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
