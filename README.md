# tcxh-icons

面向团队的 **SVG 图标管理平台**，支持在 Web 界面中上传、分类、预览图标，并一键将 SVG 打包为 **Vue 3 组件库**发布到 npm。产物 API 与类型声明对齐 [@element-plus/icons-vue](https://github.com/element-plus/element-plus-icons) 风格，便于在业务项目中直接按需引入。

## 特性

- **可视化管理** — 图标网格预览，支持按名称搜索、按分类筛选
- **批量上传** — 支持 SVG / PNG / JPG / WEBP / GIF，可多选上传
- **一键发包** — 自动将 SVG 转为 Vue 单文件组件，经 Vite 构建后发布到 npm
- **命名规范** — 统一生成 `kebab-case` 组件标签（如 `ai-start-icon`）与 PascalCase 导出名（如 `AiStartIcon`）
- **完整类型** — 自动生成 `dist/types`，含 `iconList`、`IconName` 与 Vue 全局组件声明
- **SVG 预处理** — 发布时自动将尺寸设为 `1em`、填充色改为 `currentColor`，便于主题适配

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3、TypeScript、Vite、Element Plus |
| 后端 | Node.js、Express、Multer |
| 构建产物 | Vite Library Mode、ESM + CJS 双格式 |

## 项目结构

```
tcxh-icons/
├── client/                 # 管理端前端（Vite + Vue 3）
│   └── src/
│       ├── App.vue         # 主界面：上传、筛选、发包
│       └── utils/iconMeta.ts
├── server/
│   ├── src/
│   │   ├── index.js        # Express 入口
│   │   ├── routes/
│   │   │   ├── icons.js    # 图标 CRUD
│   │   │   └── publish.js  # npm 配置与发包
│   │   └── utils/
│   ├── data/icons.json     # 图标元数据
│   ├── uploads/            # 上传文件存储
│   └── output/             # 发包构建临时目录（已 gitignore）
└── package.json            # 根脚本：同时启动前后端
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm 或 pnpm

### 安装

```bash
git clone <repository-url>
cd tcxh-icons
npm install
cd client && npm install && cd ..
```

### 开发

在根目录同时启动后端（默认 `3001`）与前端（默认 `5173`）：

```bash
npm run dev
```

浏览器访问 [http://localhost:5173](http://localhost:5173)。前端通过 Vite 代理将 `/api`、`/uploads` 转发到后端。

单独启动：

```bash
npm run dev:server   # 仅后端
npm run dev:client   # 仅前端
```

### 生产

```bash
npm run build        # 构建前端
npm start            # 启动后端（PORT 可通过环境变量配置）
```

## 使用指南

### 1. 管理图标

1. 点击 **上传图标**，拖拽或选择文件（支持批量）
2. 可为图标指定名称与分类；批量上传时默认使用各文件名
3. 在卡片上可 **复制标签**（仅 SVG 图标参与发包）
4. 非 SVG 格式（PNG 等）可用于预览展示，但不会打入 npm 包

### 2. 配置 npm 并发布

1. 点击 **NPM 配置**，填入 [Granular Access Token](https://www.npmjs.com/settings/~/tokens)
   - 权限需勾选 **Read and write packages**
   - 若账号开启 2FA，需勾选 **Bypass two-factor authentication for automation**
   - Registry 建议使用官方源：`https://registry.npmjs.org/`
2. 点击 **一键发包**，填写包名、版本号、描述
3. 确认预览后点击 **发布到 NPM**

服务端会依次：生成 Vue 组件 → 写入 `package.json` / `vite.config.ts` → `pnpm install` & `pnpm build` → 生成类型声明 → `npm publish`。

### 3. 在业务项目中使用已发布的包

以默认包名 `tcxh-icons` 为例：

```bash
npm install tcxh-icons
```

```vue
<script setup lang="ts">
import { AiStartIcon, iconList, type IconName } from 'tcxh-icons'
</script>

<template>
  <AiStartIcon style="font-size: 24px; color: #409eff" />
  <!-- 或使用 kebab-case 标签名 -->
  <ai-start-icon />
</template>
```

全局注册（可选）：

```ts
import * as TcxhIcons from 'tcxh-icons'
import type { App } from 'vue'

export function registerIcons(app: App) {
  for (const [key, component] of Object.entries(TcxhIcons)) {
    if (key !== 'iconList') {
      app.component(key, component)
    }
  }
}
```

在 `tsconfig.json` 中引用全局类型：

```json
{
  "compilerOptions": {
    "types": ["tcxh-icons/global"]
  }
}
```

## 图标命名规则

上传时的 `name` 会经 `iconMeta` 转换为统一格式：

| 输入名称 | 组件标签 | 导出名 |
|----------|----------|--------|
| `aiStart` | `ai-start-icon` | `AiStartIcon` |
| `ai-start` | `ai-start-icon` | `AiStartIcon` |
| `nav01` | `nav01-icon` | `Nav01Icon` |

规则摘要：

- 驼峰 / 下划线 → `kebab-case`
- 末尾统一追加 `-icon` 后缀
- 数字开头会自动加 `icon-` 前缀

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/icons` | 获取图标列表 |
| `POST` | `/api/icons` | 上传图标（`multipart/form-data`） |
| `DELETE` | `/api/icons/:id` | 删除图标 |
| `GET` | `/api/icons/categories` | 获取分类列表 |
| `GET` | `/api/publish/npm-status` | 查询 npm 配置状态 |
| `POST` | `/api/publish/npm-login` | 保存 npm Token |
| `DELETE` | `/api/publish/npm-config` | 清除 npm 配置 |
| `POST` | `/api/publish/preview` | 预览发包信息 |
| `POST` | `/api/publish` | 构建并发布到 npm |
| `GET` | `/api/health` | 健康检查 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3001` | 后端监听端口 |

## 相关说明

- **数据持久化**：图标元数据保存在 `server/data/icons.json`，文件保存在 `server/uploads/`
- **敏感信息**：npm Token 写入 `server/output/.npmrc`，该路径已在 `.gitignore` 中忽略，请勿提交到版本库
- **构建产物**：发包过程中的临时目录位于 `server/output/`，同样已忽略

## 脚本参考

| 命令 | 说明 |
|------|------|
| `npm run dev` | 并行启动前后端开发服务 |
| `npm run dev:server` | 仅启动 Express 后端 |
| `npm run dev:client` | 仅启动 Vite 前端 |
| `npm run build` | 构建前端静态资源 |
| `npm start` | 启动后端服务 |

## License

暂未指定开源协议。如需对外分发，请补充 `LICENSE` 文件。
