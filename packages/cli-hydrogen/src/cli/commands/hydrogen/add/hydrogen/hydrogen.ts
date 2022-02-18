import Command from '../../../../core/Command';

export async function addHydrogen(this: Command) {
  this.package.install('@shopify/hydrogen');
}
