import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

interface BaseField {
  ui_type: string
  name: string
  label: string
  help_text: string
  required: boolean
}

type BudgetScheduleField = BaseField & {
  ui_type: 'budget-schedule'
  use_scheduling: boolean
  use_end_date: boolean
  use_daily_budget: boolean
  use_lifetime_budget: boolean
}

type DiscountPickerField = BaseField & {
  ui_type: 'discount-picker'
  min_resources: number | null
  max_resources: number | null
}

type ScheduleField = BaseField & {
  ui_type: 'schedule'
  use_end_date: boolean
}

type ProductPickerField = BaseField & {
  ui_type: 'product-picker'
  allow_product_image_selection: boolean
  allow_uploaded_image_as_product_image: boolean
  allow_free_image_as_product_image: boolean
  min_resources: number | null
  max_resources: number | null
  min_image_select_per_product: number | null
  max_image_select_per_product: number | null
}

type TextMultiLineField = BaseField & {
  ui_type: 'text-multi-line'
  placeholder: string
  min_length: number
  max_length: number
}

type SelectSingleField = BaseField & {
  ui_type: 'select-single'
  choices: {label: string; value: string}[]
}

type ParagraphField = BaseField & {
  ui_type: 'paragraph'
  heading: string
  body: string
}

type TypeAheadField = BaseField & {
  ui_type: 'type-ahead'
  placeholder: string
}

type NumberField = BaseField & {
  ui_type: 'number-float' | 'number-integer'
  min: number
  max: number
  step: number
}

type ImagePickerField = BaseField & {
  ui_type: 'image-picker'
  min_resources: number
  max_resources: number
  allow_free_images: boolean
  alt_text_required: boolean
}

type Field =
  | BudgetScheduleField
  | DiscountPickerField
  | ScheduleField
  | ProductPickerField
  | TextMultiLineField
  | SelectSingleField
  | ParagraphField
  | TypeAheadField
  | NumberField
  | ImagePickerField

interface MarketingActivityDashboardConfig {
  title: string
  description: string
  app_api_url: string
  tactic: string
  platform?: string
  ad_format?: string
  is_automation: boolean
  is_automation_step?: boolean
  use_external_editor?: boolean
  enable_pricing_confirmation?: boolean
  pricing_information?: string
  preview_data: {
    label: string
    value: string
  }[]
  fields: Field[]
}

/**
 * Given a dashboard-built payments extension config file, convert it to toml for the CLI extension
 */
export function buildTomlObject(extension: ExtensionRegistration): string {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: MarketingActivityDashboardConfig = JSON.parse(versionConfig)

  const localExtensionRepresentation = {
    extensions: [
      {
        type: 'marketing_activity_extension_cli',
        name: config.title,
        handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
        title: config.title,
        description: config.description,
        app_api_url: config.app_api_url,
        tactic: config.tactic,
        platform: config.platform,
        ad_format: config.ad_format,
        is_automation: config.is_automation,
        is_automation_step: config.is_automation_step,
        use_external_editor: config.use_external_editor,
        enable_pricing_confirmation: config.enable_pricing_confirmation,
        pricing_information: config.pricing_information,
        preview_data: config.preview_data,
        fields: config.fields,
      },
    ],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
