#!/usr/bin/env node
/**
 * 发布构建：前后端分别打包
 * - dist/client   前端静态资源（Vite build）
 * - dist/server   后端 pkg 可执行文件 + 运行时目录
 */
const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const clientDist = path.join(dist, 'client');
const serverDist = path.join(dist, 'server');

const PKG_NODE = process.env.PKG_NODE || '18';
const PKG_TARGETS = process.env.PKG_TARGETS;

const platformMap = {
  darwin: 'macos',
  linux: 'linux',
  win32: 'win',
};
const archMap = { x64: 'x64', arm64: 'arm64' };

const resolvePkgTarget = () => {
  if (PKG_TARGETS) return PKG_TARGETS.split(',').map((t) => t.trim());
  const plat = platformMap[os.platform()];
  const arch = archMap[os.arch()] || os.arch();
  if (!plat) throw new Error(`Unsupported platform: ${os.platform()}`);
  return [`node${PKG_NODE}-${plat}-${arch}`];
};

const pkgBin = path.join(root, 'node_modules', '.bin', 'pkg');

const run = (cmd, opts = {}) => {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd: root, stdio: 'inherit', ...opts });
};

const args = process.argv.slice(2);
const clientOnly = args.includes('--client-only');
const serverOnly = args.includes('--server-only');
const buildClient = !serverOnly;
const buildServer = !clientOnly;

const main = async () => {
  console.log('=== tcxh-icons release build ===\n');

  if (!clientOnly) fs.ensureDirSync(serverDist);
  if (!serverOnly) {
    fs.removeSync(clientDist);
    fs.ensureDirSync(clientDist);
  }

  if (buildClient) {
    console.log('[client] Building frontend...');
    run('npm run build', { cwd: path.join(root, 'client') });
    fs.copySync(path.join(root, 'client/dist'), clientDist);
    console.log(`  -> ${clientDist}\n`);
  }

  if (buildServer) {
  console.log('[server] Packaging backend with pkg...');
  const targets = resolvePkgTarget();
  for (const target of targets) {
    const suffix = target.includes('win') ? '.exe' : '';
    const outName = `tcxh-icons-server-${target}${suffix}`;
    const outPath = path.join(serverDist, outName);
    run(`"${pkgBin}" server/src/index.js --targets ${target} --output "${outPath}" --compress GZip`);
  }

  console.log('\n[server] Preparing runtime directories...');
  fs.ensureDirSync(path.join(serverDist, 'output'));

  const srcUploads = path.join(root, 'server/uploads');
  const destUploads = path.join(serverDist, 'uploads');
  if (fs.existsSync(srcUploads)) {
    fs.copySync(srcUploads, destUploads);
    const count = fs.readdirSync(destUploads).length;
    console.log(`  Copied ${count} file(s) to uploads/`);
  } else {
    fs.ensureDirSync(destUploads);
    console.warn('  Warning: server/uploads is empty, icon images will be missing');
  }

  const srcData = path.join(root, 'server/data');
  if (fs.existsSync(srcData)) {
    fs.copySync(srcData, path.join(serverDist, 'data'));
  } else {
    fs.ensureDirSync(path.join(serverDist, 'data'));
    fs.writeJsonSync(path.join(serverDist, 'data/icons.json'), {
      icons: [],
      categories: ['通用', '箭头', '编辑', '媒体', '文件', '其他'],
    });
  }

  const binaryName =
    fs.readdirSync(serverDist).find((f) => f.startsWith('tcxh-icons-server-')) || 'tcxh-icons-server';

  fs.writeFileSync(
    path.join(serverDist, 'start.sh'),
    `#!/bin/bash
cd "$(dirname "$0")"
export TCXH_HOME="$(pwd)"
export PORT="\${PORT:-4000}"
# 默认托管 dist/client 前端（与后端同端口访问）
export CLIENT_DIST="\${CLIENT_DIST:-\$(cd "\$(dirname "\$0")/.." && pwd)/client}"
exec "./${binaryName}" "$@"
`,
    { mode: 0o755 }
  );

  fs.writeFileSync(
    path.join(serverDist, 'start.bat'),
    `@echo off
cd /d "%~dp0"
set TCXH_HOME=%cd%
if not defined PORT set PORT=4000
if not defined SERVE_CLIENT set SERVE_CLIENT=0
if not defined CLIENT_DIST set CLIENT_DIST=%cd%\\..\\client
for %%f in (tcxh-icons-server-*.exe) do (
  "%%f"
  exit /b %errorlevel%
)
echo No executable found.
exit /b 1
`
  );

  }

  if (buildClient && !fs.existsSync(path.join(dist, 'nginx.example.conf'))) {
  fs.writeFileSync(
    path.join(dist, 'nginx.example.conf'),
    `# 将 root 指向 dist/client，API 代理到后端
server {
    listen 80;
    server_name icons.example.com;

    root /path/to/dist/client;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
`
  );
  }

  console.log('\n=== Build complete ===');
  console.log(`  Frontend: ${clientDist}`);
  console.log(`  Backend:  ${serverDist}`);
  console.log('\nDeploy:');
  console.log('  1. Copy dist/server/ to server host, run ./start.sh');
  console.log('  2. Copy dist/client/ to CDN/Nginx, or set SERVE_CLIENT=1');
  console.log('  3. See dist/nginx.example.conf for reverse proxy');
  console.log('\nNote: npm publish requires pnpm & npm on PATH (not bundled in pkg).');
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
