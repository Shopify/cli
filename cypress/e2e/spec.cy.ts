describe('empty spec', () => {
  it('passes', () => {
    // cy.visit('https://checkout-web.extensions-sandbox-test.alfonso-noriega.eu.spin.dev/information')
    cy.visit(`${Cypress._instanceName}/information`)
  })
})
