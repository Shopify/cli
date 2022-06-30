/* eslint-disable */
'use strict'

function convertUrlToWebSocket(urlString) {
  return urlString.replace(/^(http)(s)?:\/\//, 'ws$2://')
}

module.exports = {
  convertUrlToWebSocket,
}
