const path = require('path');
const fs = require('fs-extra');
const { uploadsDir } = require('./storage');
const { normalizeColorMode } = require('./colorMode');

/** 解析图标文件绝对路径（兼容旧版平铺在 uploads/ 根目录） */
const resolveUploadPath = (icon) => {
  const mode = normalizeColorMode(icon.colorMode);
  if (icon.filename && icon.filename.includes('/')) {
    return path.join(uploadsDir, icon.filename);
  }
  const legacy = path.join(uploadsDir, icon.filename);
  if (fs.existsSync(legacy)) return legacy;
  return path.join(uploadsDir, mode, icon.filename);
};

const buildIconFileRef = (colorMode, basename) => {
  const mode = normalizeColorMode(colorMode);
  return {
    colorMode: mode,
    filename: `${mode}/${basename}`,
    url: `/uploads/${mode}/${basename}`,
  };
};

module.exports = { resolveUploadPath, buildIconFileRef };
