<template>
  <div class="app">
    <!-- 头部 -->
    <header class="header">
      <div class="logo">
        <el-icon :size="24"><Picture /></el-icon>
        <span>图标库</span>
      </div>
      <div class="header-actions">
        <el-button @click="openNpmConfig">
          <el-icon><Setting /></el-icon>
          NPM 配置
          <el-tag :type="npmConfigured ? 'success' : 'warning'" size="small" class="npm-tag">
            {{ npmConfigured ? '已配置' : '未配置' }}
          </el-tag>
        </el-button>
        <el-button type="primary" @click="openPublish">
          <el-icon><Upload /></el-icon>一键发包
        </el-button>
      </div>
    </header>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input v-model="search" placeholder="搜索图标名称" clearable style="width: 240px">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="category" placeholder="选择分类" clearable style="width: 160px">
        <el-option label="全部分类" value="" />
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <span class="count">共 {{ filteredIcons.length }} 个图标</span>
    </div>

    <!-- 图标网格 -->
    <div class="icon-grid" v-loading="loading">
      <div
        v-for="icon in filteredIcons"
        :key="icon.id"
        class="icon-card"
        :class="{ 'is-svg': icon.type === 'svg' }"
      >
        <img :src="API + icon.url" :alt="icon.name" class="icon-img" />
        <span class="icon-name" :title="icon.name">{{ icon.name }}</span>
        <template v-if="icon.type === 'svg'">
          <span class="icon-tag" :title="getTemplateTag(icon.name)">{{ getIconTag(icon.name) }}</span>
          <el-button
            class="copy-tag-btn"
            size="small"
            text
            type="primary"
            @click.stop="copyTemplateTag(icon)"
          >
            <el-icon><DocumentCopy /></el-icon>
            复制标签
          </el-button>
        </template>
        <span v-else class="icon-tag muted">非 SVG，不参与发包</span>
        <el-icon class="delete-btn" @click.stop="deleteIcon(icon)"><Delete /></el-icon>
      </div>
      <!-- 上传入口 -->
      <div class="icon-card add-card" @click="openUpload">
        <el-icon :size="32"><Plus /></el-icon>
        <span>上传图标</span>
      </div>
    </div>

    <!-- 上传弹窗 -->
    <el-dialog
      v-model="uploadVisible"
      title="上传图标"
      width="520px"
      @open="resetUploadDialog"
    >
      <el-upload
        v-model:file-list="uploadFileList"
        drag
        multiple
        :auto-upload="false"
        accept=".svg,.png,.jpg,.jpeg,.webp,.gif"
      >
        <el-icon :size="48"><UploadFilled /></el-icon>
        <div>拖拽文件到此处，或点击选择（支持批量）</div>
        <template #tip><div class="tip">支持 SVG / PNG / JPG / WEBP / GIF，可多选</div></template>
      </el-upload>
      <el-form :model="form" label-width="80px" style="margin-top: 20px">
        <el-form-item label="图标名称">
          <el-input
            v-model="form.name"
            :disabled="uploadFileList.length > 1"
            :placeholder="uploadFileList.length > 1 ? '批量上传时使用各文件名' : '留空则使用文件名'"
          />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" style="width: 100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" :disabled="!uploadFileList.length" @click="confirmUpload">
          确认上传{{ uploadFileList.length ? ` (${uploadFileList.length})` : '' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- NPM Token 配置弹窗 -->
    <el-dialog v-model="npmConfigVisible" title="NPM Token 配置" width="560px">
      <el-alert type="info" :closable="false" class="npm-guide">
        <template #title>如何获取可用的 Token</template>
        <ol class="guide-list">
          <li>打开 <a href="https://www.npmjs.com/settings/~/tokens" target="_blank">npm Access Tokens</a></li>
          <li>点击 <strong>Generate New Token</strong> → 选择 <strong>Granular Access Token</strong></li>
          <li>Permissions 勾选 <strong>Read and write packages</strong></li>
          <li>若账号开启了 2FA，必须勾选 <strong>Bypass two-factor authentication for automation</strong></li>
          <li>Registry 请使用官方源：<code>https://registry.npmjs.org/</code>（不要用 npmmirror）</li>
        </ol>
      </el-alert>

      <el-alert v-if="npmConfigured" type="success" :closable="false" style="margin-top: 16px">
        当前已配置 · Registry：<code>{{ npmRegistry }}</code>
      </el-alert>

      <el-form :model="npmConfig" label-width="100px" style="margin-top: 20px">
        <el-form-item label="NPM Token" required>
          <el-input
            v-model="npmConfig.token"
            type="password"
            show-password
            placeholder="npm_xxxxxxxx"
            autocomplete="off"
          />
        </el-form-item>
        <el-form-item label="Registry">
          <el-input v-model="npmConfig.registry" placeholder="https://registry.npmjs.org/" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="npmConfigVisible = false">关闭</el-button>
        <el-button v-if="npmConfigured" type="danger" text @click="resetNpmConfig">清除配置</el-button>
        <el-button type="primary" :loading="savingConfig" @click="saveNpmConfig">保存 Token</el-button>
      </template>
    </el-dialog>

    <!-- 发包弹窗 -->
    <el-dialog v-model="publishVisible" title="一键发包到 NPM" width="680px">
      <el-alert v-if="!npmConfigured" type="warning" :closable="false" style="margin-bottom: 16px">
        <template #title>尚未配置 NPM Token</template>
        <el-button type="primary" link @click="openNpmConfigFromPublish">前往配置 →</el-button>
      </el-alert>

      <el-alert v-else type="success" :closable="false" style="margin-bottom: 16px">
        NPM 已就绪（{{ npmRegistry }}），将 SVG 图标打包为 Vue 组件库并发布
      </el-alert>

      <el-form :model="pkg" label-width="100px" :disabled="!npmConfigured">
        <el-form-item label="包名">
          <el-input v-model="pkg.packageName" placeholder="@scope/icons" />
        </el-form-item>
        <el-form-item label="版本号">
          <el-input v-model="pkg.version" placeholder="1.0.0" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="pkg.description" placeholder="My icon library" />
        </el-form-item>
      </el-form>
      <div class="preview-info">
        <p>可发布的 SVG 图标：<strong>{{ svgCount }}</strong> 个</p>
        <p>安装：<code>npm install {{ pkg.packageName }}</code></p>
        <p v-if="usageHint">导入示例：<code>{{ usageHint.import }}</code></p>
      </div>

      <div v-if="publishIcons.length" class="publish-icon-list">
        <div
          v-for="item in publishIcons"
          :key="item.id"
          class="publish-icon-item"
        >
          <img :src="API + item.url" :alt="item.name" class="publish-icon-img" />
          <div class="publish-icon-meta">
            <span class="publish-icon-name">{{ item.name }}</span>
            <code class="publish-icon-tag" :title="item.template">{{ item.template }}</code>
            <el-button size="small" type="primary" plain @click="copyText(item.template)">
              <el-icon><DocumentCopy /></el-icon>
              复制标签
            </el-button>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="publishVisible = false">取消</el-button>
        <el-button text @click="openNpmConfigFromPublish">NPM 配置</el-button>
        <el-button
          type="primary"
          :loading="publishing"
          :disabled="!npmConfigured || svgCount === 0"
          @click="publish"
        >
          发布到 NPM
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadUserFile } from 'element-plus'
import { Picture, Upload, Search, Delete, Plus, UploadFilled, Setting, DocumentCopy } from '@element-plus/icons-vue'
import { resolveIconMeta, toTemplateTag } from './utils/iconMeta'

const API = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:4000' : '')

interface Icon { id: string; name: string; url: string; category: string; type: string }

const icons = ref<Icon[]>([])
const categories = ref<string[]>([])
const loading = ref(false)
const search = ref('')
const category = ref('')
const uploadVisible = ref(false)
const uploading = ref(false)
const uploadFileList = ref<UploadUserFile[]>([])
const publishVisible = ref(false)
const npmConfigVisible = ref(false)
const publishing = ref(false)
const savingConfig = ref(false)
const npmConfigured = ref(false)
const npmRegistry = ref('https://registry.npmjs.org/')
const form = ref({ name: '', category: '通用' })
const pkg = ref({ packageName: 'tcxh-icons', version: '1.0.0', description: '童创星河图标库' })
const npmConfig = ref({ token: '', registry: 'https://registry.npmjs.org/' })
const usageHint = ref<{ import: string; template: string } | null>(null)

interface PublishIconPreview {
  id: string
  name: string
  url: string
  tag: string
  exportName: string
  template: string
}

const publishIcons = ref<PublishIconPreview[]>([])

const getIconTag = (name: string) => resolveIconMeta(name).tag
const getTemplateTag = (name: string) => toTemplateTag(getIconTag(name))

const filteredIcons = computed(() => icons.value.filter(i => 
  (!search.value || i.name.toLowerCase().includes(search.value.toLowerCase())) &&
  (!category.value || i.category === category.value)
))

const svgCount = computed(() => icons.value.filter(i => i.type === 'svg').length)

const fetchData = async () => {
  loading.value = true
  try {
    const [iconsRes, catsRes] = await Promise.all([
      fetch(`${API}/api/icons`).then(r => r.json()),
      fetch(`${API}/api/icons/categories`).then(r => r.json())
    ])
    icons.value = iconsRes.icons
    categories.value = catsRes.categories
  } finally { loading.value = false }
}

const checkNpmStatus = async () => {
  try {
    const res = await fetch(`${API}/api/publish/npm-status`).then(r => r.json())
    npmConfigured.value = res.configured
    if (res.registry) npmRegistry.value = res.registry
  } catch {
    npmConfigured.value = false
  }
}

const openNpmConfig = async () => {
  await checkNpmStatus()
  npmConfigVisible.value = true
}

const openNpmConfigFromPublish = () => {
  publishVisible.value = false
  openNpmConfig()
}

const fetchUsageHint = async () => {
  try {
    const res = await fetch(`${API}/api/publish/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pkg.value),
    }).then((r) => r.json())
    usageHint.value = res.usage || null
    publishIcons.value = res.icons || []
  } catch {
    usageHint.value = null
    publishIcons.value = []
  }
}

const copyText = async (text: string) => {
  await navigator.clipboard.writeText(text)
  ElMessage.success(`已复制：${text}`)
}

const copyTemplateTag = (icon: Icon) => {
  copyText(getTemplateTag(icon.name))
}

const openPublish = async () => {
  await checkNpmStatus()
  await fetchUsageHint()
  publishVisible.value = true
}

const saveNpmConfig = async () => {
  if (!npmConfig.value.token) return ElMessage.warning('请输入 NPM Token')
  savingConfig.value = true
  try {
    const res = await fetch(`${API}/api/publish/npm-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(npmConfig.value)
    }).then(r => r.json())
    if (res.success) {
      ElMessage.success('NPM 配置成功')
      npmConfigured.value = true
      if (res.registry) npmRegistry.value = res.registry
      npmConfig.value.token = ''
      npmConfigVisible.value = false
    } else {
      ElMessage.error(res.error || '配置失败')
    }
  } finally { savingConfig.value = false }
}

const resetNpmConfig = async () => {
  await ElMessageBox.confirm('确定清除已保存的 NPM Token？', '提示', { type: 'warning' })
  await fetch(`${API}/api/publish/npm-config`, { method: 'DELETE' })
  npmConfigured.value = false
  npmConfig.value.token = ''
  ElMessage.success('NPM 配置已清除')
}

const resetUploadDialog = () => {
  form.value = { name: '', category: '通用' }
  uploadFileList.value = []
}

const openUpload = () => {
  uploadVisible.value = true
}

const confirmUpload = async () => {
  if (!uploadFileList.value.length) {
    return ElMessage.warning('请先选择要上传的文件')
  }

  uploading.value = true
  let success = 0
  let failed = 0

  for (const item of uploadFileList.value) {
    if (!item.raw) continue
    const fd = new FormData()
    fd.append('file', item.raw)
    fd.append('category', form.value.category)
    if (form.value.name.trim() && uploadFileList.value.length === 1) {
      fd.append('name', form.value.name.trim())
    }
    try {
      const res = await fetch(`${API}/api/icons`, { method: 'POST', body: fd })
      if (res.ok) success++
      else failed++
    } catch {
      failed++
    }
  }

  uploading.value = false

  if (success > 0) {
    ElMessage.success(
      failed > 0 ? `成功上传 ${success} 个，${failed} 个失败` : `成功上传 ${success} 个图标`
    )
    uploadVisible.value = false
    fetchData()
  } else {
    ElMessage.error('上传失败，请检查文件格式后重试')
  }
}

const deleteIcon = async (icon: Icon) => {
  await ElMessageBox.confirm(`确定删除 "${icon.name}"？`, '提示', { type: 'warning' })
  await fetch(`${API}/api/icons/${icon.id}`, { method: 'DELETE' })
  ElMessage.success('删除成功')
  fetchData()
}

const publish = async () => {
  if (svgCount.value === 0) return ElMessage.warning('没有可发布的 SVG 图标')
  publishing.value = true
  try {
    const res = await fetch(`${API}/api/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pkg.value)
    }).then(r => r.json())
    
    if (res.success) {
      const hint = res.usage
        ? `\n${res.usage.import}\n<template>${res.usage.template}</template>`
        : ''
      ElMessage.success({ message: `${res.message}${hint}`, duration: 6000, showClose: true })
      publishVisible.value = false
    } else if (res.code === 'NPM_NOT_CONFIGURED') {
      npmConfigured.value = false
      ElMessage.warning('请先配置 NPM Token')
    } else {
      const msg = res.hint ? `${res.error}：${res.hint}` : (res.error || '发布失败')
      ElMessage.error({ message: msg, duration: 8000, showClose: true })
      if (res.code === 'NPM_2FA_REQUIRED') {
        openNpmConfig()
      }
    }
  } finally { publishing.value = false }
}

onMounted(() => {
  fetchData()
  checkNpmStatus()
})
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fa; }

.app { max-width: 1200px; margin: 0 auto; padding: 20px; }

.header { 
  display: flex; justify-content: space-between; align-items: center; 
  padding: 16px 24px; background: #fff; border-radius: 12px; margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.logo { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 600; color: #303133; }
.header-actions { display: flex; align-items: center; gap: 12px; }
.npm-tag { margin-left: 6px; }
.guide-list { margin: 8px 0 0 18px; padding: 0; line-height: 1.8; font-size: 13px; }
.guide-list code { background: #f0f2f5; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
.npm-guide a { color: #409eff; }

.filter-bar { 
  display: flex; align-items: center; gap: 16px; 
  padding: 16px 24px; background: #fff; border-radius: 12px; margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.count { margin-left: auto; color: #909399; font-size: 14px; }

.icon-grid { 
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px;
  padding: 24px; background: #fff; border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.icon-card { 
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 20px 12px 12px; border-radius: 10px; border: 1px solid #ebeef5;
  transition: all 0.2s; position: relative; min-height: 140px;
}
.icon-card.is-svg:hover { border-color: #409eff; box-shadow: 0 4px 12px rgba(64,158,255,0.15); }
.icon-card:hover .delete-btn { opacity: 1; }

.icon-img { width: 48px; height: 48px; object-fit: contain; margin-bottom: 8px; }
.icon-name { font-size: 12px; color: #303133; text-align: center; word-break: break-all; font-weight: 500; }
.icon-tag {
  font-size: 11px; color: #409eff; font-family: ui-monospace, monospace;
  margin-top: 4px; text-align: center; word-break: break-all;
}
.icon-tag.muted { color: #c0c4cc; font-family: inherit; }
.copy-tag-btn { margin-top: 6px; padding: 0 4px; height: auto; }

.delete-btn { 
  position: absolute; top: 8px; right: 8px; color: #f56c6c; opacity: 0; transition: opacity 0.2s;
}

.add-card { border-style: dashed; color: #909399; gap: 8px; }
.add-card:hover { border-color: #409eff; color: #409eff; }

.tip { font-size: 12px; color: #909399; margin-top: 8px; }

.preview-info { 
  padding: 16px; background: #f5f7fa; border-radius: 8px; margin-top: 16px;
  font-size: 14px; color: #606266;
}
.preview-info p { margin: 8px 0; }
.preview-info code { background: #e6f7ff; padding: 2px 8px; border-radius: 4px; color: #1890ff; }

.publish-icon-list {
  margin-top: 16px;
  max-height: 320px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.publish-icon-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.publish-icon-img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  flex-shrink: 0;
}
.publish-icon-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.publish-icon-name { font-size: 13px; color: #606266; }
.publish-icon-tag {
  font-size: 12px;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  color: #409eff;
  word-break: break-all;
}

.el-alert a { color: #409eff; text-decoration: none; }
.el-alert a:hover { text-decoration: underline; }
</style>
