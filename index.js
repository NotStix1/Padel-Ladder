const { spawnSync, spawn } = require('child_process')
const path = require('path')

try {
  // Build frontend if dist missing
  const distPath = path.join(__dirname, 'frontend', 'dist')
  const serveFrontend = process.env.SERVE_FRONTEND !== '0'
  if (serveFrontend) {
    try {
      require('fs').accessSync(distPath)
    } catch (_) {
      console.log('[launcher] Building frontend...')
      spawnSync('npm', ['-w', 'frontend', 'run', 'build'], { stdio: 'inherit' })
    }
  }
} catch (e) {
  console.warn('[launcher] Frontend build step skipped:', e?.message)
}

const child = spawn('node', ['backend/src/index.js'], { stdio: 'inherit', env: process.env })
child.on('exit', (code) => process.exit(code ?? 0))
