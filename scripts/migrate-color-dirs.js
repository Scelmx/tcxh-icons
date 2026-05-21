#!/usr/bin/env node
/**
 * 将 uploads/ 根目录下的旧 SVG 迁移到 monochrome/ 或 multicolor/，
 * 并更新 data/icons.json 中的 filename、url、colorMode。
 */
const path = require('path');
const fs = require('fs-extra');
const { detectColorModeFromSvg } = require('../server/src/utils/svgProcess');
const { buildIconFileRef } = require('../server/src/utils/iconPath');

const root = path.join(__dirname, '..');
const uploadsDir = path.join(root, 'server/uploads');
const iconsFile = path.join(root, 'server/data/icons.json');

const main = () => {
  fs.ensureDirSync(path.join(uploadsDir, 'monochrome'));
  fs.ensureDirSync(path.join(uploadsDir, 'multicolor'));

  const data = fs.readJsonSync(iconsFile);
  let moved = 0;

  for (const icon of data.icons) {
    if (icon.filename && icon.filename.includes('/')) continue;

    const legacyPath = path.join(uploadsDir, icon.filename);
    if (!fs.existsSync(legacyPath)) continue;

    let colorMode = icon.colorMode;
    if (!colorMode && icon.type === 'svg') {
      const content = fs.readFileSync(legacyPath, 'utf-8');
      colorMode = detectColorModeFromSvg(content);
    } else if (!colorMode) {
      colorMode = 'monochrome';
    }

    const destPath = path.join(uploadsDir, colorMode, icon.filename);
    fs.moveSync(legacyPath, destPath, { overwrite: false });
    Object.assign(icon, buildIconFileRef(colorMode, icon.filename));
    moved++;
  }

  fs.writeJsonSync(iconsFile, data, { spaces: 2 });
  console.log(`Migrated ${moved} icon file(s) into monochrome/ or multicolor/.`);
};

main();
