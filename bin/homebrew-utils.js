const stableVersionPattern = /^\d+\.\d+\.\d+$/

/**
 * Whether a stable version is the newest stable release among the published versions.
 *
 * npm's `latest` dist-tag can't answer this, because every stable branch publishes with
 * `--tag latest`, so a patch to an older release line moves `latest` to itself.
 *
 * @param {string} version
 * @param {string[]} publishedVersions
 * @returns {boolean}
 */
export function isNewestStableVersion(version, publishedVersions) {
  return publishedVersions
    .filter((publishedVersion) => stableVersionPattern.test(publishedVersion))
    .every((publishedVersion) => compareStableVersions(publishedVersion, version) <= 0)
}

/**
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareStableVersions(left, right) {
  const leftParts = left.split('.').map(Number)
  const rightParts = right.split('.').map(Number)
  const differingIndex = leftParts.findIndex((part, index) => part !== rightParts[index])
  return differingIndex === -1 ? 0 : leftParts[differingIndex] - rightParts[differingIndex]
}
