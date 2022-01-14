import {path} from '@shopify/cli-support';

function doSomething() {
  console.log(`hello world: ${path.join('a', 'b')}`);
}
export default doSomething;
