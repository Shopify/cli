const base = require('../../jest.config');

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...base,
  globals: {
    'ts-jest': {
      useESM: true,
      isolatedModules: true,
    },
  },
};
