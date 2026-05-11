import {app, net} from 'electron'

const GITHUB_OWNER = 'coder-kingyifan'
const GITHUB_REPO = 'king-mate'
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`

export interface UpdateInfo {
    hasUpdate: boolean
    currentVersion: string
    latestVersion: string
    downloadUrl: string
    releaseNotes: string
}

/** 简单 semver 比较：a > b 返回 1，a < b 返回 -1，相等返回 0 */
function compareSemver(a: string, b: string): number {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
        const na = pa[i] || 0
        const nb = pb[i] || 0
        if (na > nb) return 1
        if (na < nb) return -1
    }
    return 0
}

/** 检查 GitHub Releases 是否有新版本 */
export async function checkForUpdate(): Promise<UpdateInfo> {
    const currentVersion = app.getVersion()

    const result: UpdateInfo = {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        downloadUrl: '',
        releaseNotes: ''
    }

    try {
        const html = await fetchReleasesPage()
        if (!html) return result

        // 从 HTML 中解析最新 release 的版本号和下载链接
        // GitHub Releases 页面结构：每个 release 有一个 div 包含版本标签和资产链接
        const versionMatch = html.match(/\/releases\/tag\/v?([\d.]+)/)
        if (!versionMatch) return result

        const latestVersion = versionMatch[1]
        result.latestVersion = latestVersion

        // 解析 exe 下载链接（优先 setup，其次 portable）
        const assetRegex = /href="([^"]*\.exe)"/g
        const exeUrls: string[] = []
        let match: RegExpExecArray | null
        while ((match = assetRegex.exec(html)) !== null) {
            exeUrls.push(match[1])
        }
        const setupUrl = exeUrls.find(u => u.includes('setup'))
        const portableUrl = exeUrls.find(u => u.includes('portable'))
        const chosenUrl = setupUrl || portableUrl || exeUrls[0]

        if (chosenUrl) {
            result.downloadUrl = chosenUrl.startsWith('http') ? chosenUrl : `https://github.com${chosenUrl}`
        } else {
            result.downloadUrl = `${GITHUB_RELEASES_URL}/latest`
        }

        result.hasUpdate = compareSemver(latestVersion, currentVersion) > 0
    } catch (e: any) {
        console.error('[updater] 检查更新失败:', e.message)
        // 将网络错误向上抛出，让前端可以区分网络问题和其他错误
        const code = e.code || ''
        if (code === 'ENOTFOUND' || code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ERR_NETWORK') {
            throw new Error('无法访问 GitHub，请检查网络连接或网络代理设置')
        }
        throw e
    }

    return result
}

/** 请求 GitHub Releases 页面（不走 API，不受速率限制） */
function fetchReleasesPage(): Promise<string> {
    return new Promise((resolve, reject) => {
        const request = net.request({
            method: 'GET',
            url: GITHUB_RELEASES_URL
        })
        request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')

        let body = ''
        request.on('response', (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`GitHub 返回状态码 ${response.statusCode}`))
                return
            }
            response.on('data', (chunk) => {
                body += chunk.toString()
            })
            response.on('end', () => {
                resolve(body)
            })
        })
        request.on('error', (err) => {
            reject(err)
        })
        request.end()
    })
}
