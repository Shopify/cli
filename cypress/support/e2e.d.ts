// Augment Cypress types with the following:
declare namespace Cypress {
  interface Cypress {
    /** Internal value used to track the spin instance name */
    _instanceName: string
  }
}
