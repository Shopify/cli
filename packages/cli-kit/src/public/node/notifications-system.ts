import {versionSatisfies} from './node-package-manager.js'
import {renderError, renderInfo, renderWarning} from './ui.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {NotificationsKey, cacheRetrieveOrRepopulate} from '../../private/node/conf-store.js'

const URL = 'https://raw.githubusercontent.com/Shopify/cli/notifications-sytem/notifications.json'

interface Notifications {
  notifications: Notification[]
}

export interface Notification {
  message: string
  type: 'info' | 'warning' | 'error'
  title?: string
  minVersion?: string
  maxVersion?: string
  minDate?: string
  maxDate?: string
  commands?: string[]
  surface?: 'app' | 'theme' | 'hydrogen' | string
  frequency?: 'always' | 'once_a_day' | 'once_a_week'
}

/**
 * Shows notifications to the user if they meet the criteria specified in the notifications.json file.
 *
 * @param commandId - The command ID that triggered the notifications.
 * @param _surface - The surface that triggered the notifications.
 * @returns - A promise that resolves when the notifications have been shown.
 */
export async function showNotificationsIfNeeded(commandId: string, _surface?: string): Promise<void> {
  const notifications = await getNotifications()
  const notificationsToShow = filterNotifications(notifications.notifications, commandId)

  notificationsToShow.forEach((notification) => {
    const content = {
      headline: notification.title,
      body: notification.message,
    }
    switch (notification.type) {
      case 'info': {
        renderInfo(content)
        return
      }
      case 'warning': {
        renderWarning(content)
        return
      }
      case 'error': {
        renderError(content)
      }
    }
  })
}

/**
 * Get notifications list from cache or fetch it if not present.
 */
async function getNotifications(): Promise<Notifications> {
  const cacheKey: NotificationsKey = `notifications-${URL}`
  const rawNotifications = await cacheRetrieveOrRepopulate(cacheKey, fetchNotifications, 24 * 3600 * 1000)
  return JSON.parse(rawNotifications)
}

/**
 * Fetch notifications from GitHub.
 */
async function fetchNotifications(): Promise<string> {
  const response = await fetch(URL)
  return response.text() as unknown as string
}

/**
 * Filters notifications based on the version of the CLI.
 *
 * @param notifications - The notifications to filter.
 * @param commandId - The command ID to filter by.
 * @param today - The current date.
 * @param currentVersion - The current version of the CLI.
 * @returns - The filtered notifications.
 */
export function filterNotifications(
  notifications: Notification[],
  commandId: string,
  today: Date = new Date(),
  currentVersion: string = CLI_KIT_VERSION,
): Notification[] {
  const surface = commandId.split(':')[0] ?? 'all'
  return notifications
    .filter((notification) => filterByVersion(notification, currentVersion))
    .filter((notifications) => filterByDate(notifications, today))
    .filter((notification) => filterByCommand(notification, commandId))
    .filter((notification) => filterBySurface(notification, surface))
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
  return !notification.commands || notification.commands.includes(commandId)
}

/**
 * Filters notifications based on the surface.
 *
 * @param notification - The notification to filter.
 * @param surface - The surface to filter by.
 * @returns - A boolean indicating whether the notification should be shown.
 */
function filterBySurface(notification: Notification, surface: string) {
  return !notification.surface || notification.surface === surface
}
