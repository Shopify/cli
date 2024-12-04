import {MAX_EXTENSION_HANDLE_LENGTH} from '../../models/extensions/schemas.js'
import {ExtensionRegistration} from '../../api/graphql/all_app_extension_registrations.js'
import {encodeToml} from '@shopify/cli-kit/node/toml'
import {slugify} from '@shopify/cli-kit/common/string'

interface BaseField {
  id: string
  ui_type: string
}

interface CommonField extends BaseField {
  name: string
  label: string
  help_text: string
  required: boolean
}

type BudgetScheduleField = CommonField & {
  ui_type: 'budget-schedule'
  use_scheduling: boolean
  use_end_date: boolean
  use_daily_budget: boolean
  use_lifetime_budget: boolean
}

type DiscountPickerField = CommonField & {
  ui_type: 'discount-picker'
  min_resources: number | null
  max_resources: number | null
}

type ScheduleField = CommonField & {
  ui_type: 'schedule'
  use_end_date: boolean
}

type ProductPickerField = CommonField & {
  ui_type: 'product-picker'
  allow_product_image_selection: boolean
  allow_uploaded_image_as_product_image: boolean
  allow_free_image_as_product_image: boolean
  min_resources: number | null
  max_resources: number | null
  min_image_select_per_product: number | null
  max_image_select_per_product: number | null
}

type SingleLineTextField = CommonField & {
  ui_type: 'text-single-line' | 'text-email' | 'text-tel' | 'text-url'
  placeholder: string
  min_length: number
  max_length: number
}

type TextMultiLineField = CommonField & {
  ui_type: 'text-multi-line'
  placeholder: string
  min_length: number
  max_length: number
}

type DividerField = BaseField & {
  ui_type: 'divider'
  title: string
  name: string
}

type SelectField = CommonField & {
  ui_type: 'select-single' | 'select-multiple'
  choices: {label: string; value: string}[]
}

type ParagraphField = BaseField & {
  ui_type: 'paragraph'
  heading: string
  body: string
}

type TypeAheadField = CommonField & {
  ui_type: 'type-ahead'
  placeholder: string
}

type NumberField = CommonField & {
  ui_type: 'number-float' | 'number-integer'
  min: number
  max: number
  step: number
}

type ImagePickerField = CommonField & {
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
  | SingleLineTextField
  | TextMultiLineField
  | SelectField
  | ParagraphField
  | TypeAheadField
  | NumberField
  | ImagePickerField
  | DividerField

export interface MarketingActivityDashboardConfig {
  title: string
  description: string
  app_api_url: string
  tactic: string
  platform: string
  is_automation: boolean
  use_external_editor?: boolean
  preview_data: {
    label: string
    value: string
  }[]
  fields: Field[]
}

const PLATFORM_CHANNEL_MAP: {[key: string]: string} = {
  facebook: 'social',
  instagram: 'social',
  google: 'search',
  pinterest: 'social',
  bing: 'search',
  email: 'email',
  snapchat: 'social',
  sms: 'sms',
  verizon_media: 'display',
  ebay: 'marketplace',
  tiktok: 'social',
  flow: 'email',
}

const PLATFORM_DOMAIN_MAP: {[key: string]: string | null} = {
  facebook: 'facebook.com',
  instagram: 'instagram.com',
  google: 'google.com',
  pinterest: 'pinterest.com',
  bing: 'bing.com',
  snapchat: 'snapchat.com',
  verizon_media: null,
  email: null,
  sms: null,
  ebay: 'ebay.com',
  tiktok: 'tiktok.com',
  flow: null,
}

function getUrlPath(url: string) {
  const urlObject = new URL(url)
  return urlObject.pathname + urlObject.search + urlObject.hash
}

/**
 * Given a dashboard-built marketing activity extension config file, convert it to toml for the CLI extension
 */
export function buildTomlObject(extension: ExtensionRegistration): string {
  const versionConfig = extension.activeVersion?.config ?? extension.draftVersion?.config
  if (!versionConfig) throw new Error('No config found for extension')
  const config: MarketingActivityDashboardConfig = JSON.parse(versionConfig)

  const localExtensionRepresentation = {
    extensions: [
      {
        type: 'marketing_activity',
        name: extension.title,
        handle: slugify(extension.title.substring(0, MAX_EXTENSION_HANDLE_LENGTH)),
        title: config.title,
        description: config.description,
        api_path: getUrlPath(config.app_api_url),
        tactic: config.tactic,
        marketing_channel: PLATFORM_CHANNEL_MAP[config.platform] ?? '',
        referring_domain: PLATFORM_DOMAIN_MAP[config.platform] ?? '',
        is_automation: config.is_automation,
        use_external_editor: config.use_external_editor,
        preview_data: config.preview_data,
        fields: config.fields.map(({id, ...field}) => field),
      },
    ],
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return encodeToml(localExtensionRepresentation as any)
}
