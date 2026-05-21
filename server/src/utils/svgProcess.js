const { normalizeColorMode } = require('./colorMode');

const normalizeSize = (content) =>
  content
    .replace(/<\?xml[^?]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/width="[^"]*"/g, 'width="1em"')
    .replace(/height="[^"]*"/g, 'height="1em"');

/** 单色：fill 转为 currentColor，便于主题色继承 */
const toMonochrome = (content) =>
  normalizeSize(content).replace(/fill="(?!none)[^"]*"/gi, 'fill="currentColor"');

/** 多色：保留原始 #hex / url() 等，仅规范尺寸 */
const toMulticolor = (content) => normalizeSize(content);

const processSvg = (content, colorMode) => {
  const mode = normalizeColorMode(colorMode);
  return mode === 'multicolor' ? toMulticolor(content) : toMonochrome(content);
};

const collectPaintColors = (content) => {
  const paints = new Set();
  const add = (raw) => {
    const v = raw.trim().toLowerCase();
    if (v && v !== 'none' && v !== 'currentcolor' && !v.startsWith('url(')) paints.add(v);
  };
  for (const m of content.matchAll(/(?:fill|stroke)\s*=\s*['"]([^'"]+)['"]/gi)) add(m[1]);
  for (const m of content.matchAll(/(?:fill|stroke)\s*:\s*([^;"'}\s]+)/gi)) add(m[1]);
  return paints;
};

/** 根据 SVG 内容判断是否多色 */
const detectColorModeFromSvg = (content) => {
  if (/url\s*\(\s*#/i.test(content)) return 'multicolor';
  return collectPaintColors(content).size > 1 ? 'multicolor' : 'monochrome';
};

/**
 * 发包时判定色彩模式（优先级：元数据/目录 > 内容检测）
 * - 已标记 multicolor 或位于 uploads/multicolor/ → 必定保留原始 fill
 * - 否则按 SVG 内容检测；检测到多色则归入 multicolor
 */
const resolvePublishColorMode = (icon, svgContent) => {
  const detected = detectColorModeFromSvg(svgContent);
  if (icon.colorMode === 'multicolor' || icon.filename?.startsWith('multicolor/')) {
    return 'multicolor';
  }
  return detected;
};

module.exports = {
  processSvg,
  detectColorModeFromSvg,
  resolvePublishColorMode,
  toMonochrome,
  toMulticolor,
};
