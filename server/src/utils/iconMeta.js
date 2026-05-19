// 驼峰 / 下划线 / 已有短横线 → kebab-case
const toKebabCase = (str) =>
  str
    .replace(/[_\s]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();

// 图标标签名：驼峰转短横线，末尾统一追加 -icon（如 aiStart → ai-start-icon）
const toIconTagName = (name) => {
  const cleaned = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '');
  let kebab = toKebabCase(cleaned);
  if (!kebab) kebab = 'icon';
  if (/^\d/.test(kebab)) kebab = `icon-${kebab}`;
  kebab = kebab.replace(/-?icon$/i, '') || 'icon';
  return `${kebab}-icon`;
};

// JS/TS 导出名：ai-start-icon → AiStartIcon
const toExportName = (tagName) =>
  tagName
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

const resolveIconMeta = (name) => {
  const tag = toIconTagName(name);
  return { tag, exportName: toExportName(tag), fileName: tag };
};

const toTemplateTag = (tag) => `<${tag} />`;

module.exports = {
  toKebabCase,
  toIconTagName,
  toExportName,
  resolveIconMeta,
  toTemplateTag,
};
