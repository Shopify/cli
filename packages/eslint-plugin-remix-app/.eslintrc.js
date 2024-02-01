"use strict";

module.exports = {
  root: true,
  plugins: ["@shopify/remix-app"],
  extends: [
    "eslint:recommended",
    "plugin:eslint-plugin/recommended",
    "plugin:node/recommended",
    "plugin:@shopify/remix-app/recommended",
  ],
  env: {
    node: true,
  },
  overrides: [
    {
      files: ["tests/**/*.js"],
      env: { mocha: true },
    },
  ],
};
