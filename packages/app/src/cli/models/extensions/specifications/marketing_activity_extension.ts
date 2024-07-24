import {createExtensionSpecification} from '../specification.js'
import {BaseSchema} from '../schemas.js'
import {zod} from '@shopify/cli-kit/node/schema'

const BaseFieldSchema = zod.object({
  id: zod.string(),
  ui_type: zod.string(),
})

const CommonFieldSchema = BaseFieldSchema.extend({
  name: zod.string(),
  label: zod.string(),
  help_text: zod.string().optional(),
  required: zod.boolean(),
})

const BudgetScheduleFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.literal('budget-schedule'),
  use_scheduling: zod.boolean(),
  use_end_date: zod.boolean(),
  use_daily_budget: zod.boolean(),
  use_lifetime_budget: zod.boolean(),
})

const DiscountPickerFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.literal('discount-picker'),
  min_resources: zod.number().nullable(),
  max_resources: zod.number().nullable(),
})

const ScheduleFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.literal('schedule'),
  use_end_date: zod.boolean(),
})

const ProductPickerFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.literal('product-picker'),
  allow_product_image_selection: zod.boolean(),
  allow_uploaded_image_as_product_image: zod.boolean(),
  allow_free_image_as_product_image: zod.boolean(),
  min_resources: zod.number().nullable(),
  max_resources: zod.number().nullable(),
  min_image_select_per_product: zod.number().nullable(),
  max_image_select_per_product: zod.number().nullable(),
})

const SingleLineTextFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.enum(['text-single-line', 'text-email', 'text-tel', 'text-url']),
  placeholder: zod.string(),
  min_length: zod.number(),
  max_length: zod.number(),
})

const TextMultiLineFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.literal('text-multi-line'),
  placeholder: zod.string(),
  min_length: zod.number(),
  max_length: zod.number(),
})

const DividerFieldSchema = BaseFieldSchema.extend({
  ui_type: zod.literal('divider'),
  title: zod.string(),
  name: zod.string(),
})

const SelectFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.enum(['select-single', 'select-multiple']),
  choices: zod.array(
    zod.object({
      label: zod.string(),
      value: zod.string(),
    }),
  ),
})

const ParagraphFieldSchema = BaseFieldSchema.extend({
  ui_type: zod.literal('paragraph'),
  heading: zod.string().optional(),
  body: zod.string().optional(),
})

const TypeAheadFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.literal('type-ahead'),
  placeholder: zod.string(),
})

const NumberFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.enum(['number-float', 'number-integer']),
  min: zod.number(),
  max: zod.number(),
  step: zod.number(),
})

const ImagePickerFieldSchema = CommonFieldSchema.extend({
  ui_type: zod.literal('image-picker'),
  min_resources: zod.number(),
  max_resources: zod.number(),
  allow_free_images: zod.boolean(),
  alt_text_required: zod.boolean(),
})

const FieldSchema = zod.union([
  BudgetScheduleFieldSchema,
  DiscountPickerFieldSchema,
  ScheduleFieldSchema,
  ProductPickerFieldSchema,
  SingleLineTextFieldSchema,
  TextMultiLineFieldSchema,
  SelectFieldSchema,
  ParagraphFieldSchema,
  TypeAheadFieldSchema,
  NumberFieldSchema,
  ImagePickerFieldSchema,
  DividerFieldSchema,
])

const MarketingActivityExtensionSchema = BaseSchema.extend({
  title: zod.string().min(1),
  description: zod.string().min(1),
  app_api_url: zod.string(),
  tactic: zod.enum([
    'ad',
    'retargeting',
    'post',
    'message',
    'transactional',
    'newsletter',
    'abandoned_cart',
    'affililate',
    'loyalty',
    'link',
    'storefront_app',
  ]),
  channel: zod.enum(['social', 'search', 'email', 'sms', 'display', 'marketplace']),
  referring_domain: zod.string().optional(),
  is_automation: zod.boolean().optional(),
  use_external_editor: zod.boolean().optional(),
  preview_data: zod.object({
    types: zod
      .array(
        zod.object({
          label: zod.string(),
          value: zod.string(),
        }),
      )
      .max(3)
      .min(1),
  }),
  fields: zod.array(FieldSchema).min(1),
})

const spec = createExtensionSpecification({
  identifier: 'marketing_activity_extension_cli',
  schema: MarketingActivityExtensionSchema,
  appModuleFeatures: (_) => ['bundling'],
  deployConfig: async (config, _) => {
    return {
      title: config.title,
      description: config.description,
      app_api_url: config.app_api_url,
      tactic: config.tactic,
      channel: config.channel,
      referring_domain: config.referring_domain,
      is_automation: config.is_automation,
      use_external_editor: config.use_external_editor,
      preview_data: config.preview_data,
      fields: config.fields,
    }
  },
})

export default spec
