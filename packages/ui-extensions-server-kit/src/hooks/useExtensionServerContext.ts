import {extensionServerContext} from '../context/index.js'
import {useContext} from 'react'

export const useExtensionServerContext = () => useContext(extensionServerContext)
