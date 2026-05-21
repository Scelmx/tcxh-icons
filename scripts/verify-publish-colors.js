#!/usr/bin/env node
/**
 * 本地校验：模拟发包时的 SVG 处理，不发布 npm
 * 用法: node scripts/verify-publish-colors.js [图标名称]
 */
const path = require('path');
const fs = require('fs-extra');
const { getData } = require('../server/src/utils/storage');
const { resolveUploadPath } = require('../server/src/utils/iconPath');
const { resolvePublishColorMode, processSvg } = require('../server/src/utils/svgProcess');

const filterName = process.argv[2];

const icons = getData().icons.filter((i) => i.type === 'svg' && (!filterName || i.name === filterName));

if (!icons.length) {
  console.error(filterName ? `未找到 SVG: ${filterName}` : '没有 SVG 图标');
  process.exit(1);
}

let ok = true;
for (const icon of icons) {
  const raw = fs.readFileSync(resolveUploadPath(icon), 'utf-8');
  const mode = resolvePublishColorMode(icon, raw);
  const out = processSvg(raw, mode);
  const hasHex = /#[0-9A-Fa-f]{3,8}/.test(out);
  const hasCurrent = /fill="currentColor"/i.test(out);

  if (mode === 'multicolor' && hasCurrent) {
    ok = false;
    console.log(`✗ ${icon.name}: multicolor 但输出含 currentColor`);
  } else if (mode === 'multicolor' && !hasHex) {
    ok = false;
    console.log(`✗ ${icon.name}: multicolor 但无 #hex 颜色`);
  } else {
    console.log(`✓ ${icon.name}: ${mode} | #hex=${hasHex} | currentColor=${hasCurrent}`);
  }
}

process.exit(ok ? 0 : 1);
