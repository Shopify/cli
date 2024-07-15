import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {randomUUID} from '@shopify/cli-kit/node/crypto'
import {writeFile} from '@shopify/cli-kit/node/fs'
import {
  Notifications,
  getLocalNotifications,
  Notification,
  stringifyFilters,
} from '@shopify/cli-kit/node/notifications-system'
import {outputInfo} from '@shopify/cli-kit/node/output'
import {renderSelectPrompt, renderTextPrompt, renderSuccess, renderTable, TableColumn} from '@shopify/cli-kit/node/ui'

export async function generate() {
  const today = new Date()
  const formattedToday = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today
    .getDate()
    .toString()
    .padStart(2, '0')}`
  const id = randomUUID()

  const type: 'info' | 'warning' | 'error' = await renderSelectPrompt({
    message: 'Type of message?',
    choices: [
      {label: 'Info', value: 'info'},
      {label: 'Warning', value: 'warning'},
      {label: 'Error', value: 'error'},
    ],
  })
  const title = await renderTextPrompt({
    message: 'Title',
  })
  const message = await renderTextPrompt({
    message: 'Message',
  })
  const frequency: 'always' | 'once' | 'once_a_day' | 'once_a_week' = await renderSelectPrompt({
    message: 'Frequency',
    choices: [
      {label: 'Only once', value: 'once'},
      {label: 'Once a week', value: 'once_a_week'},
      {label: 'Once a day', value: 'once_a_day'},
      {label: 'Always', value: 'always'},
    ],
  })
  const minVersion = await renderTextPrompt({
    message: 'Minimum CLI version (optional)',
    initialAnswer: CLI_KIT_VERSION,
    allowEmpty: true,
  })
  const maxVersion = await renderTextPrompt({
    message: 'Maximum CLI version (optional)',
    initialAnswer: CLI_KIT_VERSION,
    allowEmpty: true,
  })
  const minDate = await renderTextPrompt({
    message: 'Minimum date in YYYY-MM-DD format (optional)',
    initialAnswer: formattedToday,
    allowEmpty: true,
  })
  const maxDate = await renderTextPrompt({
    message: 'Maximum date in YYYY-MM-DD format (optional)',
    initialAnswer: formattedToday,
    allowEmpty: true,
  })
  const surface = await renderTextPrompt({
    message: 'Surface. E.g.: app, theme, hydrogen, theme_app_extension... (optional)',
    allowEmpty: true,
  })
  const commands = await renderTextPrompt({
    message: 'Comma separated list of commands. E.g.: app:generate:extension (optional)',
    allowEmpty: true,
  })
  const ownerChannel = await renderTextPrompt({
    message: 'Slack channel of the team who will own this notification',
  })

  const notifications: Notifications = await getLocalNotifications()
  const notification: Notification = {
    id,
    type,
    title,
    frequency,
    message,
    minVersion: minVersion.length === 0 ? undefined : minVersion,
    maxVersion: maxVersion.length === 0 ? undefined : maxVersion,
    minDate: minDate.length === 0 ? undefined : minDate,
    maxDate: maxDate.length === 0 ? undefined : maxDate,
    surface: surface.length === 0 ? undefined : surface,
    commands: commands.length === 0 ? undefined : commands.split(',').map((command) => command.trim()),
    ownerChannel,
  }
  notifications.notifications.push(notification)
  await writeFile('./notifications.json', JSON.stringify(notifications))

  renderSuccess({headline: 'notifications.json file updated successfully.'})
}

export async function list() {
  const notifications: Notifications = await getLocalNotifications()

  const columns: TableColumn<{type: string; title: string; message: string; filters: string}> = {
    type: {header: 'Type', color: 'dim'},
    title: {header: 'Title', color: 'dim'},
    message: {header: 'Message', color: 'dim'},
    filters: {header: 'Filters', color: 'dim'},
  }

  const rows = notifications.notifications.map((notification: Notification) => {
    return {
      type: notification.type,
      title: notification.title || '',
      message: notification.message,
      filters: stringifyFilters(notification),
    }
  })

  renderTable({rows, columns})
  outputInfo('\n')
}
