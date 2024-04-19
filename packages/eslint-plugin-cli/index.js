module.exports = {
  rules: {
    'command-flags-with-env': require('./rules/command-flags-with-env'),
    'command-conventional-flag-env': require('./rules/command-conventional-flag-env'),
    'command-reserved-flags': require('./rules/command-reserved-flags'),
    'no-error-factory-functions': require('./rules/no-error-factory-functions'),
    'no-process-cwd': require('./rules/no-process-cwd'),
    'no-trailing-js-in-cli-kit-imports': require('./rules/no-trailing-js-in-cli-kit-imports'),
    'no-vi-manual-mock-clear': require('./rules/no-vi-manual-mock-clear'),
    'no-vi-mock-in-callbacks': require('./rules/no-vi-mock-in-callbacks'),
    'prompt-message-format': require('./rules/prompt-message-format'),
    'specific-imports-in-bootstrap-code': require('./rules/specific-imports-in-bootstrap-code'),
    'banner-headline-format': require('./rules/banner-headline-format'),
    'required-fields-when-loading-app': require('./rules/required-fields-when-loading-app'),
  },

  configs: {
    config: require('./config'),
  },
}
