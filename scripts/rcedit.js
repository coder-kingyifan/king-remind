const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const EXE_PATH = path.join(ROOT, 'dist', 'win-unpacked', 'king-remind.exe')
const ICON_PATH = path.join(ROOT, 'resources', 'build', 'icons', 'win', 'icon.ico')

// Find rcedit in electron-builder cache
const RCEDIT_PATH = path.join(
  process.env.LOCALAPPDATA || '',
  'electron-builder',
  'Cache',
  'winCodeSign',
  'winCodeSign-2.6.0',
  'rcedit-x64.exe'
)

function main() {
  if (!fs.existsSync(EXE_PATH)) {
    console.error('Exe not found:', EXE_PATH)
    process.exit(1)
  }

  const rcedit = fs.existsSync(RCEDIT_PATH)
    ? RCEDIT_PATH
    : require('rcedit')

  const pkg = require(path.join(ROOT, 'package.json'))

  const args = [
    EXE_PATH,
    '--set-version-string', 'FileDescription', pkg.description,
    '--set-version-string', 'ProductName', 'king-remind',
    '--set-version-string', 'LegalCopyright', 'Copyright (c) 2026 kingyifan',
    '--set-file-version', pkg.version,
    '--set-product-version', pkg.version + '.0',
    '--set-version-string', 'InternalName', 'king-remind',
    '--set-version-string', 'CompanyName', 'kingyifan',
    '--set-icon', ICON_PATH
  ]

  console.log('Setting exe resources with rcedit...')
  execFileSync(rcedit, args, { stdio: 'inherit' })
  console.log('Done.')
}

main()
