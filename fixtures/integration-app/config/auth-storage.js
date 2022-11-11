import {defineAuthStorage, RedisStorage} from '@shopify/app/auth'

export default defineAuthStorage(({development}) => {
  if (development) {
  } else {
    return new RedisStorage(process.env.REDIS_URL)
  }
})
