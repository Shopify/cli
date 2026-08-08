import {zod} from '../../public/node/schema.js'

export const NotificationSchema = zod.object({
  id: zod.string(),
  message: zod.string(),
  type: zod.enum(['info', 'warning', 'error']),
  frequency: zod.enum(['always', 'once', 'once_a_day', 'once_a_week']),
  ownerChannel: zod.string(),
  cta: zod
    .object({
      label: zod.string(),
      url: zod.string().url(),
    })
    .optional(),
  title: zod.string().optional(),
  minVersion: zod.string().optional(),
  maxVersion: zod.string().optional(),
  minDate: zod.string().optional(),
  maxDate: zod.string().optional(),
  commands: zod.array(zod.string()).optional(),
  surface: zod.string().optional(),
})

export type Notification = zod.infer<typeof NotificationSchema>

export const NotificationsSchema = zod.object({notifications: zod.array(NotificationSchema)})

export type Notifications = zod.infer<typeof NotificationsSchema>
