import {versionSatisfies} from './node-package-manager.js'
import {renderError, renderInfo, renderWarning} from './ui.js'
import {getCurrentCommandId} from './global-context.js'
import {outputDebug} from './output.js'
import {zod} from './schema.js'
import {AbortSilentError} from './error.js'
import {isTruthy} from './context/utilities.js'
import {exec} from './system.js'
import {jsonOutputEnabled} from './environment.js'
import {fetch} from './http.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {NotificationKey, NotificationsKey, cacheRetrieve, cacheStore} from '../../private/node/conf-store.js'

const URL = 'https://cdn.shopify.com/static/cli/notifications.json'
const EMPTY_CACHE_MESSAGE = 'Cache is empty'
const COMMANDS_TO_SKIP = [
  'notifications:list',
  'notifications:generate',
  'init',
  'app:init',
  'theme:init',
  'hydrogen:init',
  'cache:clear',
]

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
    const commandId = getCurrentCommandId()
    if (skipNotifications(commandId, environment) || jsonOutputEnabled(environment)) return

    const notifications = await getNotifications()
    const notificationsToShow = filterNotifications(notifications.notifications, commandId, currentSurfaces)
    outputDebug(`Notifications to show: ${notificationsToShow.length}`)
    await renderNotifications(notificationsToShow)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (error.message === EMPTY_CACHE_MESSAGE) {
      outputDebug('Notifications to show: 0 (Cache is empty)')
      return
    }
    if (error.message === 'abort') throw new AbortSilentError()
    const errorMessage = `Error showing notifications: ${error.message}`
    outputDebug(errorMessage)
    // This is very prone to becoming a circular dependency, so we import it dynamically
    const {sendErrorToBugsnag} = await import('./error-handler.js')
    await sendErrorToBugsnag(errorMessage, 'unexpected_error')
  }
}

function skipNotifications(currentCommand: string, environment: NodeJS.ProcessEnv = process.env): boolean {
  return (
    isTruthy(environment.CI) || isTruthy(environment.SHOPIFY_UNIT_TEST) || COMMANDS_TO_SKIP.includes(currentCommand)
  )
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
 * Get notifications list from cache, that is updated in the background from bin/fetch-notifications.json.
 *
 * @returns A Notifications object.
 */
export async function getNotifications(): Promise<Notifications> {
  const cacheKey: NotificationsKey = `notifications-${url()}`
  const rawNotifications = cacheRetrieve(cacheKey)?.value as unknown as string
  if (!rawNotifications) throw new Error(EMPTY_CACHE_MESSAGE)
  const notifications: object = JSON.parse(rawNotifications)
  return NotificationsSchema.parse(notifications)
}

/**
 * Fetch notifications from the CDN and chache them.
 *
 * @returns A string with the notifications.
 */
export async function fetchNotifications(): Promise<Notifications> {
  outputDebug(`Fetching notifications...`)
  const response = await fetch(url(), undefined, {
    useNetworkLevelRetry: false,
    useAbortSignal: true,
    timeoutMs: 3 * 1000,
  })
  if (response.status !== 200) throw new Error(`Failed to fetch notifications: ${response.statusText}`)
  const rawNotifications = await response.text()
  const notifications: object = JSON.parse(rawNotifications)
  const result = NotificationsSchema.parse(notifications)
  await cacheNotifications(rawNotifications)
  return result
}

/**
 * Store the notifications in the cache.
 *
 * @param notifications - String with the notifications to cache.
 * @returns A Notifications object.
 */
async function cacheNotifications(notifications: string): Promise<void> {
  cacheStore(`notifications-${url()}`, notifications)
  outputDebug(`Notifications from ${url()} stored in the cache`)
}

/**
 * Fetch notifications in background as a detached process.
 *
 * @param currentCommand - The current Shopify command being run.
 * @param argv - The arguments passed to the current process.
 * @param environment - Process environment variables.
 */
export function fetchNotificationsInBackground(
  currentCommand: string,
  argv = process.argv,
  environment: NodeJS.ProcessEnv = process.env,
): void {
  if (skipNotifications(currentCommand, environment)) return
  if (!argv[0] || !argv[1]) return

  // Run the Shopify command the same way as the current execution
  const nodeBinary = argv[0]
  const shopifyBinary = argv[1]
  const args = [shopifyBinary, 'notifications', 'list', '--ignore-errors']

  // eslint-disable-next-line no-void
  void exec(nodeBinary, args, {
    background: true,
    env: {...process.env, SHOPIFY_CLI_NO_ANALYTICS: '1'},
    externalErrorHandler: async (error: unknown) => {
      outputDebug(`Failed to fetch notifications in background: ${(error as Error).message}`)
    },
  })
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
