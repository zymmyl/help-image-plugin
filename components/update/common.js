import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { exec, execSync } = require('child_process')

let updateState = {
  running: false
}

const execCommand = (cmd) => {
  return new Promise((resolve) => {
    exec(cmd, { windowsHide: true, cwd: process.cwd() }, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr })
    })
  })
}

const execCommandSync = (cmd, options = {}) => {
  return execSync(cmd, { encoding: 'utf-8', cwd: process.cwd(), ...options })
}

export { updateState, execCommand, execCommandSync }
