import {findPathUp} from '@shopify/support';

export async function template(name: string): Promise<string | undefined> {
  return findPathUp(`templates/${name}`, __dirname, 'directory');
}
