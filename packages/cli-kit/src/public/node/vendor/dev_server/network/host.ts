import fs from 'node:fs'
import path from 'node:path'

const HOSTS_FILE = '/etc/hosts'

let hostToIpCache: Record<string, string> = {}
let lastModifiedTime = 0

function loadHostsFile() {
  try {
    const stats = fs.statSync(HOSTS_FILE)
    const modifiedTime = stats.mtimeMs

    if (modifiedTime === lastModifiedTime) return

    const hostsContent = fs.readFileSync(HOSTS_FILE, 'utf8')
    const lines = hostsContent.split(/\r?\n/)

    hostToIpCache = {}

    for (const line of lines) {
      if (line.trim().startsWith('#') || line.trim() === '') {
        continue
      }

      const matches = /^\s*(?<ipAddress>[^\s#]+)\s+(?<matchedHostName>[^\s#]+)\s*(#.*)?$/.exec(line)
      if (matches && matches.groups) {
        const {ipAddress, matchedHostName} = matches.groups
        if (matchedHostName && ipAddress) {
          hostToIpCache[matchedHostName] = ipAddress
        }
      }
    }

    lastModifiedTime = modifiedTime
  } catch (error) {
    console.log('Error reading hosts file:', error)
  }
}

export function getIpFromHosts(hostname: string) {
  loadHostsFile()

  const ipAddress = hostToIpCache[hostname]
  if (ipAddress) {
    return ipAddress
  }

  throw new Error(`No IP found for hostname: ${hostname}`)
}
