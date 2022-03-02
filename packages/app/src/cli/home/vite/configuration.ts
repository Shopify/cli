import Pages from 'vite-plugin-pages'
import type {UserConfig} from 'vite'

/**
 * It returns the Vite configuration for building home.
 * @returns {UserConfig} Vite configuration to use for building home.
 */
const configuration = (): UserConfig => {
  return {
    plugins: [Pages()],
  }
}

export default configuration
