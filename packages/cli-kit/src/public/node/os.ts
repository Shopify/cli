import {outputDebug} from '../../public/node/output.js'
import {execa} from 'execa'
import {userInfo as osUserInfo} from 'os'

// This code has been vendored from https://github.com/sindresorhus/username
// because adding it as a transtive dependency causes conflicts with other
// packages that haven't been yet migrated to the latest version.
/**
 * @param platform - The platform to get the username for. Defaults to the current platform.
 * @returns The username of the current user.
 */
export async function username(platform: typeof process.platform = process.platform): Promise<string | null> {
  outputDebug('Obtaining user name...')
  const environmentVariable = getEnvironmentVariable()
  if (environmentVariable) {
    return environmentVariable
  }

  const userInfoUsername = getUsernameFromOsUserInfo()
  if (userInfoUsername) {
    return userInfoUsername
  }

  /**
    First we try to get the ID of the user and then the actual username. We do this because in `docker run --user <uid>:<gid>` context, we don't have "username" available. Therefore, we have a fallback to `makeUsernameFromId` for such scenario. Applies also to the `sync()` method below.
    */
  try {
    if (platform === 'win32') {
      const {stdout} = await execa('whoami')
      return cleanWindowsCommand(stdout)
    }

    const {stdout: userId} = await execa('id', ['-u'])
    try {
      const {stdout} = await execa('id', ['-un', userId])
      return stdout

      // eslint-disable-next-line no-catch-all/no-catch-all,no-empty
    } catch {}
    return makeUsernameFromId(userId)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return null
  }
}

type PlatformArch = Exclude<typeof process.arch, 'x64' | 'ia32'> | 'amd64' | '386'
type PlatformStrings = Exclude<typeof process.platform, 'win32'> | 'windows'
/**
 * Returns the platform and architecture.
 * @returns Returns the current platform and architecture.
 */
export function platformAndArch(
  platform: typeof process.platform = process.platform,
  arch: typeof process.arch = process.arch,
): {
  platform: PlatformStrings
  arch: PlatformArch
} {
  let archString: PlatformArch
  if (arch === 'x64') {
    archString = 'amd64'
  } else if (arch === 'ia32') {
    archString = '386'
  } else {
    archString = arch
  }
  const platformString = (platform.match(/^win.+/) ? 'windows' : platform) as PlatformStrings
  return {platform: platformString, arch: archString}
}

function getEnvironmentVariable() {
  const {env} = process

  return env.SUDO_USER || env.C9_USER || env.LOGNAME || env.USER || env.LNAME || env.USERNAME
}

function getUsernameFromOsUserInfo(): string | null {
  try {
    return osUserInfo().username
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return null
  }
}

function cleanWindowsCommand(value: string) {
  return value.replace(/^.*\\/, '')
}

function makeUsernameFromId(userId: string) {
  return `no-username-${userId}`
}
