// declare namespace Cypress {
//   interface Cypress {
//     instanceName: string
//   }
// }
declare global {
  namespace Cypress {
    interface Cypress {
      instanceName: string
    }
  }
}
