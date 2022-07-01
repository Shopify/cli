import {getUIExtensionTemplates, isValidUIExtensionTemplate} from './template-configuration.js'
import {uiExtensions, uiExtensionTemplates} from '../../constants.js'
import {describe, expect, it} from 'vitest'

describe('get ui extension template types', () => {
  it.each(uiExtensions.types.filter((extension) => extension !== 'web_pixel_extension'))(
    'obtain all kind of template types for %s extention',
    (extension: string) => {
      // When
      const result = getUIExtensionTemplates(extension)

      // Then
      expect(result).toEqual(uiExtensionTemplates)
    },
  )
  it.each(uiExtensions.types.filter((extension) => extension === 'web_pixel_extension'))(
    'obtain filtered template types for %s extention',
    (extension: string) => {
      // When
      const result = getUIExtensionTemplates(extension)

      // Then
      expect(result).toEqual([{name: 'vanilla JavaScript', value: 'vanilla-js'}])
    },
  )
})

describe('is valid ui extension template', () => {
  it('is invalid when no ui extension type', () => {
    // When
    const result = isValidUIExtensionTemplate('product_discounts', 'react')

    // Then
    expect(result).toEqual(false)
  })
  it('is invalid when template not supported', () => {
    // When
    const result = isValidUIExtensionTemplate('web_pixel_extension', 'react')

    // Then
    expect(result).toEqual(false)
  })
  it('is invalid when template is supported', () => {
    // When
    const result = isValidUIExtensionTemplate('checkout_ui_extension', 'react')

    // Then
    expect(result).toEqual(true)
  })
})
