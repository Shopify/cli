import {buildTomlObject} from './extension-to-toml.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {describe, expect, test} from 'vitest'

describe('extension-to-toml', () => {
  test('correctly builds a toml string for a flow_action', () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'flow action @ Char!',
      type: 'flow_action_definition',
      draftVersion: {
        config:
          '{"title":"action title","description":"action description","url":"https://google.es","fields":[{"name":"customer_id","label":"Customer ID","description":"","required":true,"id":"bc16767a-02ab-4775-93e0-04bfe91a94e2","uiType":"commerce-object-id"},{"name":"product_id","label":"Product ID","description":"","required":true,"id":"8dc7911e-f15d-46ee-8aae-82eac7630378","uiType":"commerce-object-id"},{"name":"email field","label":"email label","description":"email help","required":false,"id":"b174c2aa-6cee-4e13-82f8-b60033e84835","uiType":"email"},{"name":"number name","label":"number label","description":"number help","required":true,"id":"363619e5-7b34-4fff-8bd6-c3af054be321","uiType":"number"}],"custom_configuration_page_url":"https://destinationsurl.test.dev","custom_configuration_page_preview_url":"https://previewurl.test.dev","validation_url":"https://validation.test.dev"}',
      },
    }

    // When
    const got = buildTomlObject(extension1)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "flow_action"
name = "action title"
handle = "flow-action-char"
description = "action description"
runtime_url = "https://google.es"
config_page_url = "https://destinationsurl.test.dev"
config_page_preview_url = "https://previewurl.test.dev"
validation_url = "https://validation.test.dev"

[[settings.fields]]
type = "customer_reference"
required = true

[[settings.fields]]
type = "product_reference"
required = true

[[settings.fields]]
key = "email field"
description = "email help"
type = "email"
name = "email label"
required = false

[[settings.fields]]
key = "number name"
description = "number help"
type = "number_decimal"
name = "number label"
required = true
`)
  })

  test('truncates the handle if the title has >50 characters', () => {
    // Given
    const extension1: ExtensionRegistration = {
      id: '26237698049',
      uuid: 'ad9947a9-bc0b-4855-82da-008aefbc1c71',
      title: 'flow action @ Char! flow action @ Char! flow action @ Char! flow action @ Char!',
      type: 'flow_action_definition',
      draftVersion: {
        config:
          '{"title":"action title","description":"action description","url":"https://google.es","fields":[{"name":"customer_id","label":"Customer ID","description":"","required":true,"id":"bc16767a-02ab-4775-93e0-04bfe91a94e2","uiType":"commerce-object-id"},{"name":"product_id","label":"Product ID","description":"","required":true,"id":"8dc7911e-f15d-46ee-8aae-82eac7630378","uiType":"commerce-object-id"},{"name":"email field","label":"email label","description":"email help","required":false,"id":"b174c2aa-6cee-4e13-82f8-b60033e84835","uiType":"email"},{"name":"number name","label":"number label","description":"number help","required":true,"id":"363619e5-7b34-4fff-8bd6-c3af054be321","uiType":"number"}],"custom_configuration_page_url":"https://destinationsurl.test.dev","custom_configuration_page_preview_url":"https://previewurl.test.dev","validation_url":"https://validation.test.dev"}',
      },
    }

    // When
    const got = buildTomlObject(extension1)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "flow_action"
name = "action title"
handle = "flow-action-char-flow-action-char-flow-actio"
description = "action description"
runtime_url = "https://google.es"
config_page_url = "https://destinationsurl.test.dev"
config_page_preview_url = "https://previewurl.test.dev"
validation_url = "https://validation.test.dev"

[[settings.fields]]
type = "customer_reference"
required = true

[[settings.fields]]
type = "product_reference"
required = true

[[settings.fields]]
key = "email field"
description = "email help"
type = "email"
name = "email label"
required = false

[[settings.fields]]
key = "number name"
description = "number help"
type = "number_decimal"
name = "number label"
required = true
`)
  })

  test('correctly builds a toml string for a flow_trigger', () => {
    // Given
    const extension2 = {
      id: '26237861889',
      uuid: 'e1cb40b1-2af2-4292-91a9-0824e0157bb2',
      title: 'trigger ext!"*^ÑÇ¨:"!',
      type: 'flow_trigger_definition',
      activeVersion: {
        config:
          '{"title":"trigger title","description":"trigger description","feature_version":2,"fields":[{"description":"","name":"customer_id","id":"2ed1d556-be40-488b-b4a1-3456a79d2963","uiType":"customer"},{"description":"number description","name":"number property","id":"1b76c360-f0c3-4a05-a845-d910e3546a43","uiType":"number"},{"description":"email description","name":"email name","id":"75c1a5f3-f9d1-46f8-8383-b22798fe8f89","uiType":"email"}]}',
      },
      draftVersion: {
        config:
          '{"title":"trigger title","description":"trigger description","feature_version":2,"fields":[{"description":"","name":"customer_id","id":"2ed1d556-be40-488b-b4a1-3456a79d2963","uiType":"customer"},{"description":"number description","name":"number property","id":"1b76c360-f0c3-4a05-a845-d910e3546a43","uiType":"number"},{"description":"email description","name":"email name","id":"75c1a5f3-f9d1-46f8-8383-b22798fe8f89","uiType":"email"}]}',
      },
    }

    // When
    const got = buildTomlObject(extension2)

    // Then
    expect(got).toEqual(`[[extensions]]
type = "flow_trigger"
name = "trigger title"
handle = "trigger-ext"
description = "trigger description"

[[settings.fields]]
type = "customer_reference"

[[settings.fields]]
key = "number property"
description = "number description"
type = "number_decimal"

[[settings.fields]]
key = "email name"
description = "email description"
type = "email"
`)
  })
})
