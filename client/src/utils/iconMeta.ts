export const toKebabCase = (str: string) =>
  str
    .replace(/[_\s]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

export const toIconTagName = (name: string) => {
  const cleaned = name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '')
  let kebab = toKebabCase(cleaned)
  if (!kebab) kebab = 'icon'
  if (/^\d/.test(kebab)) kebab = `icon-${kebab}`
  kebab = kebab.replace(/-?icon$/i, '') || 'icon'
  return `${kebab}-icon`
}

export const toExportName = (tagName: string) =>
  tagName
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

export const resolveIconMeta = (name: string) => {
  const tag = toIconTagName(name)
  return { tag, exportName: toExportName(tag), fileName: tag }
}

export const toTemplateTag = (tag: string) => `<${tag} />`
