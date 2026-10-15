function isCommandPath(filename) {
  return /\/src\/(?:cli\/)?commands\//.test(filename.replaceAll('\\', '/'))
}

module.exports = {isCommandPath}
