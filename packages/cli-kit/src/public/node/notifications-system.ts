import {versionSatisfies} from './node-package-manager.js'
import {renderError, renderInfo, renderWarning} from './ui.js'
import {getCurrentCommandId} from './global-context.js'
import {outputDebug} from './output.js'
import {zod} from './schema.js'
import {AbortSilentError} from './error.js'
import {isTruthy} from './context/utilities.js'
import {jsonOutputEnabled} from './environment.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {
  NotificationKey,
  NotificationsKey,
  cacheRetrieve,
  cacheRetrieveOrRepopulate,
  cacheStore,
} from '../../private/node/conf-store.js'
import {fetch} from '@shopify/cli-kit/node/http'

const URL = 'https://cdn.shopify.com/static/cli/notifications.json'
const CACHE_DURATION_IN_MS = 3600 * 1000

function url(): string {
  return process.env.SHOPIFY_CLI_NOTIFICATIONS_URL ?? URL
}

const NotificationSchema = zod.object({
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

const NotificationsSchema = zod.object({notifications: zod.array(NotificationSchema)})
export type Notifications = zod.infer<typeof NotificationsSchema>

/**
 * Shows notifications to the user if they meet the criteria specified in the notifications.json file.
 *
 * @param currentSurfaces - The surfaces present in the current project (usually for app extensions).
 * @param environment - Process environment variables.
 * @returns - A promise that resolves when the notifications have been shown.
 */
export async function showNotificationsIfNeeded(
  currentSurfaces?: string[],
  environment: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  try {
    if (skipNotifications(environment)) return

    const notifications = await getNotifications()
    const commandId = getCurrentCommandId()
    const notificationsToShow = filterNotifications(notifications.notifications, commandId, currentSurfaces)
    outputDebug(`Notifications to show: ${notificationsToShow.length}`)
    await renderNotifications(notificationsToShow)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.message === 'abort') throw new AbortSilentError()
    const errorMessage = `Error retrieving notifications: ${error.message}`
    outputDebug(errorMessage)
    // This is very prone to becoming a circular dependency, so we import it dynamically
    const {sendErrorToBugsnag} = await import('./error-handler.js')
    await sendErrorToBugsnag(errorMessage, 'unexpected_error')
  }
}

function skipNotifications(environment: NodeJS.ProcessEnv): boolean {
  return isTruthy(environment.CI) || isTruthy(environment.SHOPIFY_UNIT_TEST) || jsonOutputEnabled(environment)
}

/**
 * Renders the first 2 notifications to the user.
 *
 * @param notifications - The notifications to render.
 */
async function renderNotifications(notifications: Notification[]) {
  notifications.slice(0, 2).forEach((notification) => {
    const content = {
      headline: notification.title,
      body: notification.message.replaceAll('\\n', '\n'),
      link: notification.cta,
    }
    switch (notification.type) {
      case 'info': {
        renderInfo(content)
        break
      }
      case 'warning': {
        renderWarning(content)
        break
      }
      case 'error': {
        renderError(content)
        throw new Error('abort')
      }
    }
    cacheStore(`notification-${notification.id}`, new Date().getTime().toString())
  })
}

/**
 * Get notifications list from cache (refreshed every hour) or fetch it if not present.
 *
 * @returns A Notifications object.
 */
export async function getNotifications(): Promise<Notifications> {
  const cacheKey: NotificationsKey = `notifications-${url()}`
  const rawNotifications = await cacheRetrieveOrRepopulate(cacheKey, fetchNotifications, CACHE_DURATION_IN_MS)
  const notifications: object = JSON.parse(rawNotifications)
  return NotificationsSchema.parse(notifications)
}

/**
 * Fetch notifications from GitHub.
 */
async function fetchNotifications(): Promise<string> {
  outputDebug(`No cached notifications found. Fetching them...`)
  const response = await fetch(url(), {signal: AbortSignal.timeout(3 * 1000)})
  if (response.status !== 200) throw new Error(`Failed to fetch notifications: ${response.statusText}`)
  return response.text() as unknown as string
}

/**
 * Filters notifications based on the version of the CLI.
 *
 * @param notifications - The notifications to filter.
 * @param commandId - The command ID to filter by.
 * @param currentSurfaces - The surfaces present in the current project (usually for app extensions).
 * @param today - The current date.
 * @param currentVersion - The current version of the CLI.
 * @returns - The filtered notifications.
 */
export function filterNotifications(
  notifications: Notification[],
  commandId: string,
  currentSurfaces?: string[],
  today: Date = new Date(new Date().setUTCHours(0, 0, 0, 0)),
  currentVersion: string = CLI_KIT_VERSION,
): Notification[] {
  return notifications
    .filter((notification) => filterByVersion(notification, currentVersion))
    .filter((notifications) => filterByDate(notifications, today))
    .filter((notification) => filterByCommand(notification, commandId))
    .filter((notification) => filterBySurface(notification, commandId, currentSurfaces))
    .filter((notification) => filterByFrequency(notification))
}

/**
 * Filters notifications based on the version of the CLI.
 *
 * @param notification - The notification to filter.
 * @param currentVersion - The current version of the CLI.
 */
function filterByVersion(notification: Notification, currentVersion: string) {
  const minVersion = !notification.minVersion || versionSatisfies(currentVersion, `>=${notification.minVersion}`)
  const maxVersion = !notification.maxVersion || versionSatisfies(currentVersion, `<=${notification.maxVersion}`)
  return minVersion && maxVersion
}

/**
 * Filters notifications based on the date.
 *
 * @param notification - The notification to filter.
 * @param today - The current date.
 */
function filterByDate(notification: Notification, today: Date) {
  const minDate = !notification.minDate || new Date(notification.minDate) <= today
  const maxDate = !notification.maxDate || new Date(notification.maxDate) >= today
  return minDate && maxDate
}

/**
 * Filters notifications based on the command ID.
 *
 * @param notification - The notification to filter.
 * @param commandId - The command ID to filter by.
 * @returns - A boolean indicating whether the notification should be shown.
 */
function filterByCommand(notification: Notification, commandId: string) {
  if (commandId === '') return true
  return !notification.commands || notification.commands.includes(commandId)
}

/**
 * Filters notifications based on the surface.
 *
 * @param notification - The notification to filter.
 * @param commandId - The command id.
 * @param surfacesFromContext - The surfaces present in the current project (usually for app extensions).
 * @returns - A boolean indicating whether the notification should be shown.
 */
function filterBySurface(notification: Notification, commandId: string, surfacesFromContext?: string[]) {
  const surfaceFromCommand = commandId.split(':')[0] ?? 'all'
  const notificationSurface = notification.surface ?? 'all'

  if (surfacesFromContext) return surfacesFromContext.includes(notificationSurface)

  return notificationSurface === surfaceFromCommand || notificationSurface === 'all'
}

/**
 * Filters notifications based on the frequency.
 *
 * @param notification - The notification to filter.
 * @returns - A boolean indicating whether the notification should be shown.
 */
function filterByFrequency(notification: Notification): boolean {
  if (!notification.frequency) return true
  const cacheKey: NotificationKey = `notification-${notification.id}`
  const lastShown = cacheRetrieve(cacheKey)?.value as unknown as string
  if (!lastShown) return true

  switch (notification.frequency) {
    case 'always': {
      return true
    }
    case 'once': {
      return false
    }
    case 'once_a_day': {
      return new Date().getTime() - Number(lastShown) > 24 * 3600 * 1000
    }
    case 'once_a_week': {
      return new Date().getTime() - Number(lastShown) > 7 * 24 * 3600 * 1000
    }
  }
}

/**
 * Returns a string with the filters from a notification, one by line.
 *
 * @param notification - The notification to get the filters from.
 * @returns A string with human-readable filters from the notification.
 */
export function stringifyFilters(notification: Notification): string {
  const filters = []
  if (notification.minDate) filters.push(`from ${notification.minDate}`)
  if (notification.maxDate) filters.push(`to ${notification.maxDate}`)
  if (notification.minVersion) filters.push(`from v${notification.minVersion}`)
  if (notification.maxVersion) filters.push(`to v${notification.maxVersion}`)
  if (notification.frequency === 'once') filters.push('show only once')
  if (notification.frequency === 'once_a_day') filters.push('show once a day')
  if (notification.frequency === 'once_a_week') filters.push('show once a week')
  if (notification.surface) filters.push(`surface = ${notification.surface}`)
  if (notification.commands) filters.push(`commands = ${notification.commands.join(', ')}`)
  return filters.join('\n')
}
