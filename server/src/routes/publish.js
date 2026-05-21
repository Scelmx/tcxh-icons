const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const { outputDir, getData } = require('../utils/storage');
const { resolveIconMeta, toTemplateTag } = require('../utils/iconMeta');
const { normalizeColorMode } = require('../utils/colorMode');
const { resolveUploadPath } = require('../utils/iconPath');
const { processSvg, resolvePublishColorMode } = require('../utils/svgProcess');

const router = express.Router();

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

// 从 .npmrc 读取 registry
const readNpmrc = (npmrcPath) => {
  const content = fs.readFileSync(npmrcPath, 'utf-8');
  const registryMatch = content.match(/^registry\s*=\s*(.+)$/m);
  const registry = registryMatch ? registryMatch[1].trim() : DEFAULT_REGISTRY;
  return { registry };
};

// Vue 组件类型声明模板（与 @element-plus/icons-vue 一致）
const VUE_COMPONENT_DTS = `declare const _default: import('vue').DefineComponent<{}, void, {}, {}, {}, import('vue').ComponentOptionsMixin, import('vue').ComponentOptionsMixin, {}, string, import('vue').PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, import('vue').ComponentProvideOptions, true, {}, any>
export default _default
`;

const COLOR_MODE_DIRS = ['monochrome', 'multicolor'];

// 生成 dist/types 下的 TypeScript 声明（components 按 monochrome / multicolor 分目录）
const generateTypeDeclarations = (components, typesDir) => {
  const componentsDir = path.join(typesDir, 'components');
  fs.ensureDirSync(componentsDir);

  for (const mode of COLOR_MODE_DIRS) {
    fs.ensureDirSync(path.join(componentsDir, mode));
    const modeComponents = components.filter((c) => c.colorMode === mode);
    for (const { fileName } of modeComponents) {
      fs.writeFileSync(
        path.join(componentsDir, mode, `${fileName}.vue.d.ts`),
        VUE_COMPONENT_DTS
      );
    }
    if (modeComponents.length) {
      const componentExports = modeComponents
        .map(({ fileName, exportName }) => `export { default as ${exportName} } from './${fileName}.vue'`)
        .join('\n');
      fs.writeFileSync(path.join(componentsDir, mode, 'index.d.ts'), `${componentExports}\n`);
    }
  }

  const barrel = COLOR_MODE_DIRS.filter((mode) =>
    components.some((c) => c.colorMode === mode)
  )
    .map((mode) => `export * from './${mode}'`)
    .join('\n');
  fs.writeFileSync(path.join(componentsDir, 'index.d.ts'), `${barrel}\n`);

  const iconListLiteral = components.map((c) => `'${c.tag}'`).join(', ');
  const monoList = components.filter((c) => c.colorMode === 'monochrome').map((c) => `'${c.tag}'`).join(', ');
  const multiList = components.filter((c) => c.colorMode === 'multicolor').map((c) => `'${c.tag}'`).join(', ');

  fs.writeFileSync(
    path.join(typesDir, 'index.d.ts'),
    `export * from './components'
export declare const iconList: readonly [${iconListLiteral}]
export type IconName = (typeof iconList)[number]
${monoList ? `export declare const monochromeIconList: readonly [${monoList}]` : ''}
${multiList ? `export declare const multicolorIconList: readonly [${multiList}]` : ''}
`
  );

  const globalEntries = components
    .map(({ exportName }) => `    ${exportName}: typeof components.${exportName}`)
    .join('\n');
  fs.writeFileSync(
    path.join(typesDir, 'global.d.ts'),
    `import * as components from './components'\n\ndeclare module 'vue' {\n  export interface GlobalComponents {\n${globalEntries}\n  }\n}\n`
  );
};

// 解析 npm 命令错误，返回友好提示
const parseNpmError = (message) => {
  if (/ENEEDAUTH|need auth/i.test(message)) {
    return {
      error: 'NPM 未授权',
      code: 'NPM_AUTH_REQUIRED',
      hint: '请重新配置 NPM Token，并确认 Registry 与 Token 所属源一致（官方源：https://registry.npmjs.org/）',
    };
  }
  if (/E403|403 Forbidden/i.test(message)) {
    if (/two-factor|2fa|bypass/i.test(message)) {
      return {
        error: 'Token 权限不足',
        code: 'NPM_2FA_REQUIRED',
        hint: '账号已开启双因素认证。请在 npm 创建 Granular Access Token：勾选 Read and write packages，并开启「Bypass two-factor authentication for automation」后重新保存 Token。',
      };
    }
    if (/you do not have permission|not authorized/i.test(message)) {
      return {
        error: '没有发布权限',
        code: 'NPM_FORBIDDEN',
        hint: '该包名可能已被他人占用，或 Token 没有该包的发布权限。请更换包名，或使用有权限的账号 Token。',
      };
    }
    return {
      error: '发布被拒绝 (403)',
      code: 'NPM_FORBIDDEN',
      hint: '请检查 Token 类型、包名是否可用，以及账号是否有发布权限。',
    };
  }
  if (/E409|409 Conflict|cannot publish over/i.test(message)) {
    return {
      error: '版本已存在',
      code: 'NPM_VERSION_EXISTS',
      hint: '该版本号已在 NPM 上发布，请提高版本号后重试。',
    };
  }
  return { error: '发布失败', code: 'NPM_PUBLISH_FAILED', hint: message.split('\n').find(l => l.includes('npm error')) || message };
};

// 配置 npm 登录
router.post('/npm-login', (req, res) => {
  const { registry = DEFAULT_REGISTRY, token } = req.body;
  
  if (!token || !token.startsWith('npm_')) {
    return res.status(400).json({ error: '请提供有效的 npm Token（以 npm_ 开头）' });
  }

  try {
    const npmrcPath = path.join(outputDir, '.npmrc');
    const registryHost = new URL(registry).host;
    fs.writeFileSync(npmrcPath, `//${registryHost}/:_authToken=${token}\nregistry=${registry}\n`);
    res.json({ success: true, message: 'NPM 配置成功', registry });
  } catch (error) {
    res.status(500).json({ error: '配置失败', detail: error.message });
  }
});

// 重置 npm 配置
router.delete('/npm-config', (req, res) => {
  const npmrcPath = path.join(outputDir, '.npmrc');
  try {
    if (fs.existsSync(npmrcPath)) fs.removeSync(npmrcPath);
    res.json({ success: true, message: 'NPM 配置已清除' });
  } catch (error) {
    res.status(500).json({ error: '清除失败', detail: error.message });
  }
});

// 获取 npm 配置状态
router.get('/npm-status', (req, res) => {
  const npmrcPath = path.join(outputDir, '.npmrc');
  const configured = fs.existsSync(npmrcPath);
  let registry = DEFAULT_REGISTRY;
  if (configured) {
    try {
      registry = readNpmrc(npmrcPath).registry;
    } catch { /* ignore */ }
  }
  res.json({ configured, registry });
});

// 预览发包
router.post('/preview', (req, res) => {
  const { packageName = 'my-icons', version = '1.0.0' } = req.body;
  const data = getData();
  const svgIcons = data.icons.filter(i => i.type === 'svg');
  
  const components = svgIcons.map((i) => resolveIconMeta(i.name));
  const sample = components[0];
  res.json({
    packageName,
    version,
    iconCount: svgIcons.length,
    icons: svgIcons.map((i) => {
      const meta = resolveIconMeta(i.name);
      const rawSvg = fs.readFileSync(resolveUploadPath(i), 'utf-8');
      const colorMode = resolvePublishColorMode(i, rawSvg);
      return {
        id: i.id,
        name: i.name,
        url: i.url,
        colorMode,
        tag: meta.tag,
        exportName: meta.exportName,
        template: toTemplateTag(meta.tag),
      };
    }),
    command: `npm install ${packageName}`,
    usage: sample
      ? {
          import: `import { ${sample.exportName} } from '${packageName}'`,
          template: `<${sample.tag} />`,
        }
      : null,
  });
});

// 发布到 npm
router.post('/', async (req, res) => {
  const { packageName = 'tcxh-icons', version = '1.0.0', description = '童创星河图标库' } = req.body;
  const data = getData();
  const svgIcons = data.icons.filter(i => i.type === 'svg');

  if (svgIcons.length === 0) {
    return res.status(400).json({ error: '没有可发布的 SVG 图标' });
  }

  // 检查 npm 配置
  const npmrcPath = path.join(outputDir, '.npmrc');
  if (!fs.existsSync(npmrcPath)) {
    return res.status(400).json({ error: '请先配置 npm token', code: 'NPM_NOT_CONFIGURED' });
  }
  const { registry } = readNpmrc(npmrcPath);

  const pkgDir = path.join(outputDir, packageName);
  const srcDir = path.join(pkgDir, 'src');
  const componentsDir = path.join(srcDir, 'components');

  try {
    fs.emptyDirSync(pkgDir);
    fs.ensureDirSync(componentsDir);

    // 复制 .npmrc
    fs.copyFileSync(npmrcPath, path.join(pkgDir, '.npmrc'));

    // 生成 Vue 组件（src/components/monochrome | multicolor）
    const components = [];
    for (const icon of svgIcons) {
      const meta = resolveIconMeta(icon.name);
      const rawSvg = fs.readFileSync(resolveUploadPath(icon), 'utf-8');
      const colorMode = resolvePublishColorMode(icon, rawSvg);
      const modeDir = path.join(componentsDir, colorMode);
      fs.ensureDirSync(modeDir);

      const svgContent = processSvg(rawSvg, colorMode);

      if (colorMode === 'multicolor' && /fill="currentColor"/i.test(svgContent)) {
        throw new Error(
          `[${icon.name}] 多色图标不应包含 currentColor，请确认服务端代码已更新并重启后再发布`
        );
      }

      fs.writeFileSync(
        path.join(modeDir, `${meta.fileName}.vue`),
        `<template>\n  ${svgContent.trim()}\n</template>\n<script setup lang="ts">\ndefineOptions({ name: '${meta.exportName}' })\n</script>\n`
      );
      components.push({ ...meta, colorMode });
      console.log(`[publish] ${icon.name} → ${colorMode}/ (${colorMode === 'multicolor' ? '保留 #hex' : 'currentColor'})`);
    }

    fs.writeJsonSync(
      path.join(pkgDir, 'publish-manifest.json'),
      {
        generatedAt: new Date().toISOString(),
        icons: components.map((c) => ({
          name: c.tag,
          exportName: c.exportName,
          colorMode: c.colorMode,
        })),
      },
      { spaces: 2 }
    );

    const exports = components
      .map(
        ({ fileName, exportName, colorMode }) =>
          `export { default as ${exportName} } from './components/${colorMode}/${fileName}.vue'`
      )
      .join('\n');
    const iconTags = components.map((c) => c.tag);
    const monochromeTags = components.filter((c) => c.colorMode === 'monochrome').map((c) => c.tag);
    const multicolorTags = components.filter((c) => c.colorMode === 'multicolor').map((c) => c.tag);

    fs.writeFileSync(
      path.join(srcDir, 'index.ts'),
      `${exports}

export const iconList = ${JSON.stringify(iconTags)} as const
export const monochromeIconList = ${JSON.stringify(monochromeTags)} as const
export const multicolorIconList = ${JSON.stringify(multicolorTags)} as const
`
    );

    // 生成 package.json（对齐 @element-plus/icons-vue 的 exports / types 配置）
    fs.writeJsonSync(
      path.join(pkgDir, 'package.json'),
      {
        name: packageName,
        version,
        description,
        keywords: ['icon', 'svg', 'vue', 'vue3', 'components'],
        publishConfig: {
          registry,
          access: 'public',
        },
        sideEffects: false,
        main: './dist/index.js',
        module: './dist/index.mjs',
        types: './dist/types/index.d.ts',
        exports: {
          '.': {
            types: './dist/types/index.d.ts',
            import: './dist/index.mjs',
            require: './dist/index.js',
          },
          './global': {
            types: './dist/types/global.d.ts',
          },
        },
        typesVersions: {
          '*': {
            '*': ['./*', './dist/types/*'],
          },
        },
        files: ['dist'],
        scripts: { build: 'vite build' },
        peerDependencies: { vue: '^3.2.0' },
        devDependencies: {
          vue: '^3.4.0',
          vite: '^5.0.0',
          '@vitejs/plugin-vue': '^5.0.0',
        },
      },
      { spaces: 2 }
    );

    // 生成 vite.config.ts
    fs.writeFileSync(
      path.join(pkgDir, 'vite.config.ts'),
      `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: '${packageName.replace(/[^a-zA-Z0-9]/g, '_')}',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.mjs' : 'index.js'),
    },
    rollupOptions: {
      external: ['vue'],
      output: {
        exports: 'named',
        globals: { vue: 'Vue' },
      },
    },
  },
})
`
    );

    // 安装依赖、构建
    const pkgNpmrc = path.join(pkgDir, '.npmrc');
    const publishEnv = {
      ...process.env,
      CI: 'true',
      NPM_CONFIG_USERCONFIG: pkgNpmrc,
      NPM_CONFIG_REGISTRY: registry,
    };
    execSync('pnpm install', { cwd: pkgDir, stdio: 'pipe', env: publishEnv });
    execSync('pnpm build', { cwd: pkgDir, stdio: 'pipe', env: publishEnv });

    // vite build 会清空 dist，因此在构建后写入类型声明
    generateTypeDeclarations(components, path.join(pkgDir, 'dist', 'types'));

    execSync(`npm publish --access public --registry=${registry}`, {
      cwd: pkgDir,
      stdio: 'pipe',
      env: publishEnv,
    });

    const sample = components[0];
    const monoPublished = components.filter((c) => c.colorMode === 'monochrome').length;
    const multiPublished = components.filter((c) => c.colorMode === 'multicolor').length;
    res.json({
      success: true,
      message: `${packageName}@${version} 发布成功!（单色 ${monoPublished}，多色 ${multiPublished}）`,
      stats: { monochrome: monoPublished, multicolor: multiPublished },
      components: components.map((c) => ({
        tag: c.tag,
        exportName: c.exportName,
        colorMode: c.colorMode,
      })),
      install: `npm install ${packageName}`,
      usage: sample
        ? {
            import: `import { ${sample.exportName} } from '${packageName}'`,
            template: `<${sample.tag} />`,
            iconList: `import { iconList, type IconName } from '${packageName}'`,
          }
        : null,
    });
  } catch (error) {
    const parsed = parseNpmError(error.message || '');
    res.status(500).json({ ...parsed, detail: error.message });
  }
});

module.exports = router;
