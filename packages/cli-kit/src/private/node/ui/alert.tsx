import {Alert, AlertProps} from './components/Alert.js'
import {tokenItemToJsonString} from './components/token-item.js'
import {renderOnce} from '../ui.js'
import {commandEventOutputMode} from '../command-event-context.js'
import {LogLevel, outputInfo, outputWarn} from '../../../public/node/output.js'
import React from 'react'

import {RenderOptions} from 'ink'

const typeToLogLevel: Record<AlertProps['type'], LogLevel> = {
  info: 'info',
  warning: 'warn',
  success: 'info',
  error: 'error',
}

export interface AlertOptions extends AlertProps {
  renderOptions?: RenderOptions
}

export function alert(options: AlertOptions) {
  const {
    type,
    headline,
    body,
    nextSteps,
    reference,
    link,
    customSections,
    orderedNextSteps = false,
    renderOptions,
  } = options

  if ((type === 'info' || type === 'warning' || type === 'success') && commandEventOutputMode() === 'json') {
    const message = alertMessage(options)
    if (type === 'warning') outputWarn(message)
    else outputInfo(message)
    return message
  }

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
    {logLevel: typeToLogLevel[type], renderOptions},
  )
}

function alertMessage({headline, body, nextSteps, reference, link, customSections}: AlertProps): string {
  const sections = [
    headline ? tokenItemToJsonString(headline) : undefined,
    body ? tokenItemToJsonString(body) : undefined,
    nextSteps?.length ? `Next steps:\n${nextSteps.map(tokenItemToJsonString).join('\n')}` : undefined,
    reference?.length ? `Reference:\n${reference.map(tokenItemToJsonString).join('\n')}` : undefined,
    link ? tokenItemToJsonString({link}) : undefined,
    ...(customSections ?? []).map((section) => {
      const content =
        typeof section.body === 'object' && 'tabularData' in section.body
          ? section.body.tabularData.map((row) => row.map(tokenItemToJsonString).join('\t')).join('\n')
          : tokenItemToJsonString(section.body)
      return section.title ? `${section.title}:\n${content}` : content
    }),
  ]
  return sections.filter((section): section is string => section !== undefined).join('\n\n')
}
