import {useContext} from 'react';

import {extensionServerContext} from '../context';

export const useExtensionServerContext = () => useContext(extensionServerContext);
