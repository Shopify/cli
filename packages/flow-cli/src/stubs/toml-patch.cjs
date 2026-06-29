// flow-cli never patches TOML files; stub avoids loading the WASM binary.
module.exports.echoToml = (s) => s
module.exports.updateTomlValues = (s) => s
