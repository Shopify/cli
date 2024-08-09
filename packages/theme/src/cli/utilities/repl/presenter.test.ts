import {presentValue} from './presenter.js'
import {consoleWarn, outputContent, outputInfo, outputToken} from '@shopify/cli-kit/node/output'
import {describe, expect, test, vi} from 'vitest'

vi.mock('@shopify/cli-kit/node/output')

describe('presentValue', () => {
  test('should print a warning message if value has a JSON error', () => {
    // Given
    const value = {error: 'json not allowed for this object'}

    // When
    presentValue(value)

    // Then
    expect(consoleWarn).toHaveBeenCalledWith(
      "Object can't be printed, but you can access its fields. Read more at https://shopify.dev/docs/api/liquid.",
    )
    expect(outputInfo).not.toHaveBeenCalled()
  })

  test('should print "null" if value is undefined', () => {
    // Given
    const value = undefined

    // When
    presentValue(value)

    // Then
    expect(outputInfo).toHaveBeenCalledWith(outputContent`${outputToken.cyan('null')}`)
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  test('should print "null" if value is null', () => {
    // Given
    const value = null

    // When
    presentValue(value)

    // Then
    expect(outputInfo).toHaveBeenCalledWith(outputContent`${outputToken.cyan('null')}`)
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  test('should print the formatted output if value is not undefined, null, or has a JSON error', () => {
    // Given
    const value = {foo: 'bar'}
    const formattedOutput = JSON.stringify(value, null, 2)

    // When
    presentValue(value)

    // Then
    expect(outputInfo).toHaveBeenCalledWith(outputContent`${outputToken.cyan(formattedOutput)}`)
    expect(consoleWarn).not.toHaveBeenCalled()
  })
})
