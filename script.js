import fs from 'fs'

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
await wait(5000)
const timestamp = new Date().toLocaleString()
fs.writeFileSync('./tmp.txt', timestamp)
