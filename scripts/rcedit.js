const { execFileSync, execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const EXE_PATH = path.join(ROOT, 'dist', 'win-unpacked', 'king-mate.exe')
// 强烈建议使用 .ico 文件
const ICON_PATH = path.join(ROOT, 'build', 'icon.ico')

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
        console.error('❌ 找不到可执行文件:', EXE_PATH)
        return
    }

    // 1. 尝试强制结束可能占用的进程
    try {
        console.log('正在检查并清理残留进程...')
        execSync('taskkill /F /IM king-mate.exe /T', { stdio: 'ignore' })
    } catch (e) {
        // 进程不存在会报错，直接忽略即可
    }

    // 2. 确定 rcedit 路径
    let rceditBin = RCEDIT_PATH
    if (!fs.existsSync(RCEDIT_PATH)) {
        console.error('❌ 找不到 rcedit-x64.exe，请检查 electron-builder 缓存路径')
        return
    }

    const pkg = require(path.join(ROOT, 'package.json'))

    const args = [
        EXE_PATH,
        '--set-version-string', 'FileDescription', pkg.description || 'King Mate',
        '--set-version-string', 'ProductName', 'king-mate',
        '--set-version-string', 'LegalCopyright', 'Copyright (c) 2026 kingyifan',
        '--set-file-version', pkg.version,
        '--set-product-version', pkg.version + '.0',
        '--set-version-string', 'InternalName', 'king-mate',
        '--set-version-string', 'CompanyName', 'kingyifan',
        '--set-icon', ICON_PATH
    ]

    console.log('🚀 正在使用 rcedit 注入资源...')

    try {
        // 3. 执行修改
        execFileSync(rceditBin, args, { stdio: 'inherit' })
        console.log('✅ 修改成功！')
    } catch (err) {
        console.error('❌ 注入失败：文件可能仍被锁定或杀毒软件拦截。')
        console.error(err.message)
    }
}

main()