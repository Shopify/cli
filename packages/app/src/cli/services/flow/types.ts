export interface ConfigField {
  type: string
  required?: boolean
  key?: string
  name?: string
  description?: string
  marketingActivityCreateUrl?: string
  marketingActivityDeleteUrl?: string
}

export interface SerializedField {
  name: string
  label?: string
  description?: string
  required?: boolean
  uiType: string
  typeRefName?: string
  marketingActivityCreateUrl?: string
  marketingActivityDeleteUrl?: string
}

export type FlowExtensionTypes = 'flow_action' | 'flow_trigger'
export type FlowPartnersExtensionTypes = 'flow_action_definition' | 'flow_trigger_definition'
