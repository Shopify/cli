export interface ConfigField {
  type: string
  required?: boolean
  key?: string
  name?: string
  description?: string
}

export interface SerializedField {
  name: string
  label?: string
  description?: string
  required?: boolean
  uiType: string
}

export type FlowExtensionTypes = 'flow_action' | 'flow_trigger'
