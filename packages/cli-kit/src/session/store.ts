import {cliKit as cliKitStore} from '../store';

import Token from './token';

class Store {
  async identityToken(): Promise<Token | undefined> {
    const x = cliKitStore.get('sessions');
    return undefined;
  }
}

const store = new Store();

export default store;
