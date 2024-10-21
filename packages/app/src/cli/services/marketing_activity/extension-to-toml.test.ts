import {buildTomlObject, MarketingActivityDashboardConfig} from './extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'

const defaultDashboardConfig: MarketingActivityDashboardConfig = {
  title: 'test mae',
  description: 'test mae description',
  app_api_url: 'https://google.es/api/v1',
  tactic: 'ad',
  platform: 'facebook',
  is_automation: false,
  preview_data: [{label: 'test label', value: 'test value'}],
  fields: [
    {
      id: '123',
      ui_type: 'text-single-line',
      name: 'test_field',
      label: 'test field',
      help_text: 'help text',
      required: false,
      min_length: 1,
      max_length: 50,
      placeholder: 'placeholder',
    },
  ],
}
describe('extension-to-toml', () => {
  test('converts the dashboard config to the new cli config', () => {
    // Given
    const extension: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'mae @ test! 123',
      type: 'marketing_activity_extension',
      draftVersion: {
        config: JSON.stringify(defaultDashboardConfig),
      },
    }

    // When
    const got = buildTomlObject(extension)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "marketing_activity"
name = "mae @ test! 123"
handle = "mae-test-123"
title = "test mae"
description = "test mae description"
api_path = "/api/v1"
tactic = "ad"
marketing_channel = "social"
referring_domain = "facebook.com"
is_automation = false

  [[extensions.preview_data]]
  label = "test label"
  value = "test value"

  [[extensions.fields]]
  ui_type = "text-single-line"
  name = "test_field"
  label = "test field"
  help_text = "help text"
  required = false
  min_length = 1
  max_length = 50
  placeholder = "placeholder"
`)
  })

  test('truncates the handle if the title has >50 characters', () => {
    // Given
    const extension: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'mae @ test! 1234555555555444444777777888888812345555555554444447777778888888',
      type: 'marketing_activity_extension',
      draftVersion: {
        config: JSON.stringify(defaultDashboardConfig),
      },
    }

    // When
    const got = buildTomlObject(extension)

    // Then
    expect(got).toContain('handle = "mae-test-12345555555554444447777778888888123455"')
  })

  test('sets the channel and referring domain to empty string if no platform mapping is found', () => {
    // Given
    const extension: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'mae @ test! 123',
      type: 'marketing_activity_extension',
      draftVersion: {
        config: JSON.stringify({...defaultDashboardConfig, platform: 'not-a-platform'}),
      },
    }

    // When
    const got = buildTomlObject(extension)

    // Then
    expect(got).toContain('marketing_channel = ""')
    expect(got).toContain('referring_domain = ""')
  })
})
