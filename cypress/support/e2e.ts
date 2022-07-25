// / <reference path="e2e.d.ts" />

// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

before(() => {
  // cy.exec('spin up extensions-sandbox-app --name=extensions-sandbox-app-some-string')
  cy.exec('spin up extensions-sandbox-app')
    // cy.exec('spin up extensions-sandbox-app --name=extensions-sandbox-app-abc-123')
    .then(({stdout}) => {
      // Created instance extensions-sandbox-app-9g9y (extensions-sandbox-app-9g9y.david-henry.us.spin.dev)"
      Cypress._instanceName = stdout.split('(')[1].replace(')', '')
    })

  //   .log('spin up extensions-sandbox-app --name=extensions-sandbox-app-abc-12a3')
})
