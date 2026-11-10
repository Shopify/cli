import {validateTemplateValue, validateFlavorValue} from './validate.js'
import {describe, expect, test} from 'vitest'
import {AbortError} from '@shopify/cli-kit/node/error'

describe('validateTemplateValue', () => {
  test('should not throw an error for undefined template', () => {
    expect(() => validateTemplateValue(undefined)).not.toThrow()
  })

  test.each([
    'https://github.com/Shopify/example',
    'https://github.com/example/custom-template/subpath#branch',
    'https://github.com/Shopify/shopify-app-template-node',
  ])('should not throw an error for valid GitHub URL %s', (template) => {
    expect(() => validateTemplateValue(template)).not.toThrow()
  })

  test('should throw an AbortError for non-GitHub URL', () => {
    expect(() => validateTemplateValue('https://gitlab.com/example')).toThrow(AbortError)
  })

  test.each(['reactRouter', 'none', 'ruby', 'remix'])(
    'should not throw an error for valid predefined template %s',
    (template) => {
      expect(() => validateTemplateValue(template)).not.toThrow()
    },
  )

  test('should reject the removed node template alias', () => {
    expect(() => validateTemplateValue('node')).toThrow(AbortError)
  })

  test('should throw an AbortError for invalid template', () => {
    expect(() => validateTemplateValue('invalid-template')).toThrow(AbortError)
  })
})

describe('validateFlavorValue', () => {
  test('should not throw an error when both template and flavor are undefined', () => {
    expect(() => validateFlavorValue(undefined, undefined)).not.toThrow()
  })

  test('should throw an AbortError when flavor is provided without template', () => {
    expect(() => validateFlavorValue(undefined, 'some-flavor')).toThrow(AbortError)
  })

  test('should not throw an error when template is provided without flavor', () => {
    expect(() => validateFlavorValue('ruby', undefined)).not.toThrow()
  })

  test('should throw an AbortError when flavor is provided for custom template', () => {
    expect(() => validateFlavorValue('https://github.com/custom/template', 'some-flavor')).toThrow(AbortError)
  })

  test('should throw an AbortError when template does not support flavors', () => {
    expect(() => validateFlavorValue('ruby', 'some-flavor')).toThrow(AbortError)
  })

  test('should throw an AbortError for invalid flavor option', () => {
    expect(() => validateFlavorValue('remix', 'invalid-flavor')).toThrow(AbortError)
  })

  test('should not throw an error for valid template and flavor combination', () => {
    expect(() => validateFlavorValue('remix', 'javascript')).not.toThrow()
  })
})
