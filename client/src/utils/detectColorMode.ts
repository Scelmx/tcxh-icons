export type ColorMode = 'monochrome' | 'multicolor'

const collectPaintColors = (content: string) => {
  const paints = new Set<string>()
  const add = (raw: string) => {
    const v = raw.trim().toLowerCase()
    if (v && v !== 'none' && v !== 'currentcolor' && !v.startsWith('url(')) paints.add(v)
  }
  for (const m of content.matchAll(/(?:fill|stroke)\s*=\s*['"]([^'"]+)['"]/gi)) add(m[1])
  for (const m of content.matchAll(/(?:fill|stroke)\s*:\s*([^;"'}\s]+)/gi)) add(m[1])
  return paints
}

/** 与后端 detectColorModeFromSvg 规则一致 */
export const detectColorModeFromSvg = (content: string): ColorMode => {
  if (/url\s*\(\s*#/i.test(content)) return 'multicolor'
  return collectPaintColors(content).size > 1 ? 'multicolor' : 'monochrome'
}

export const detectColorModeFromFile = async (file: File): Promise<ColorMode | null> => {
  if (!file.name.toLowerCase().endsWith('.svg')) return null
  const content = await file.text()
  return detectColorModeFromSvg(content)
}
