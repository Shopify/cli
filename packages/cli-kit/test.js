import simpleGit from 'simple-git'

const git = simpleGit()

async function testIsClean(directory) {
  const status = await git.cwd(directory).status()
  console.log('Is clean:', status.isClean())
}

testIsClean('/Users/vincent/src/playground/happy-terriers/0').catch(console.error)
