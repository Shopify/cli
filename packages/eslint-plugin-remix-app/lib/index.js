/**
 * @fileoverview ESLint rules to prevent violations of Shopify app policies
 * @author Shopify
 */
"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const requireIndex = require("requireindex");

//------------------------------------------------------------------------------
// Plugin Definition
//------------------------------------------------------------------------------

// import all rules in lib/rules
const rules = requireIndex(__dirname + "/rules");
const ruleNames = Object.keys(rules);
module.exports = {
  rules,
  configs: {
    recommended: {
      plugins: ["@shopify/remix-app"],
      rules: ruleNames.reduce((acc, ruleName) => {
        acc[`@shopify/remix-app/${ruleName}`] = "warn";
        return acc;
      }, {})
    },
  },
};



