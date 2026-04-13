<template>
  <div class="model-config-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">模型配置</h1>
        <p class="page-subtitle">管理 AI 模型，对话时可切换</p>
      </div>
      <el-button type="primary" @click="openForm()">
        <el-icon><Plus/></el-icon>
        添加模型
      </el-button>
    </div>

    <!-- 模型类型分组 -->
    <div class="type-tabs">
      <div
        v-for="tab in typeTabs"
        :key="tab.value"
        class="type-tab"
        :class="{ active: activeType === tab.value }"
        @click="activeType = tab.value"
      >
        <span class="type-tab-icon">{{ tab.icon }}</span>
        <span class="type-tab-label">{{ tab.label }}</span>
        <span v-if="countByType(tab.value) > 0" class="type-tab-count">{{ countByType(tab.value) }}</span>
      </div>
    </div>

    <!-- 模型列表 -->
    <div v-if="filteredConfigs.length > 0" class="model-list">
      <div v-for="cfg in filteredConfigs" :key="cfg.id" class="model-card">
        <div class="model-card-body">
          <span class="model-icon">{{ getProviderIcon(cfg.provider) }}</span>
          <div class="model-info">
            <div class="model-name-row">
              <span class="model-name">{{ cfg.name }}</span>
              <el-tag v-if="cfg.is_default" size="small" type="success">默认</el-tag>
            </div>
            <div class="model-meta">{{ getProviderName(cfg.provider) }} &middot; {{ cfg.base_url || '未配置' }}</div>
            <div class="model-tags" v-if="parseModels(cfg.models).length">
              <el-tag
                v-for="m in parseModels(cfg.models)"
                :key="m"
                size="small"
                :type="m === cfg.model ? 'primary' : (isModelMultimodal(m, cfg.model_notes) ? 'warning' : 'info')"
                class="model-tag"
              >{{ m }}</el-tag>
            </div>
          </div>
        </div>
        <div class="model-actions">
          <el-button v-if="!cfg.is_default" size="small" plain @click="setDefault(cfg.id)">设为默认</el-button>
          <el-button size="small" plain @click="openForm(cfg)">编辑</el-button>
          <el-button size="small" plain type="danger" @click="handleDelete(cfg)">删除</el-button>
        </div>
      </div>
    </div>

    <div v-else class="empty-hint">
      <p>还没有配置{{ activeType === 'web_search' ? '联网搜索' : '对话' }}模型，点击上方「添加模型」开始</p>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog
      v-model="showForm"
      :title="editingId ? '编辑模型' : '添加模型'"
      width="580px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-position="top" size="default">
        <div class="form-row">
          <el-form-item label="模型类型" class="flex-1">
            <el-select v-model="form.model_type" style="width: 100%;" @change="onModelTypeChange">
              <el-option label="对话模型" value="text"/>
              <el-option label="联网搜索" value="web_search"/>
            </el-select>
          </el-form-item>
          <el-form-item label="服务商" class="flex-1">
            <el-select v-model="form.provider" style="width: 100%;" filterable @change="onProviderChange">
              <el-option v-for="p in filteredProviders" :key="p.id" :label="p.name" :value="p.id"/>
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="给这个配置起个名字，如：Ollama"/>
        </el-form-item>

        <!-- 对话模型才显示模型列表 -->
        <el-form-item v-if="form.model_type !== 'web_search'" label="模型列表" required>
          <div class="model-input-list">
            <div class="model-list-header">
              <span class="model-list-hint">点击左侧星标设为默认模型，勾选多模态可识别图片</span>
            </div>
            <div v-for="(m, idx) in form.models" :key="idx" class="model-input-row">
              <span
                class="model-default-star"
                :class="{ active: form.defaultModelIndex === idx }"
                @click="form.defaultModelIndex = idx"
                :title="form.defaultModelIndex === idx ? '当前默认模型' : '点击设为默认'"
              >{{ form.defaultModelIndex === idx ? '\u2605' : '\u2606' }}</span>
              <el-input
                v-model="form.models[idx]"
                placeholder="输入模型名称"
                @keydown.enter.prevent="addModelInput"
                style="flex: 1;"
              />
              <el-checkbox
                :model-value="form.modelMultimodal[idx]"
                @change="(val: boolean) => form.modelMultimodal[idx] = val"
              >多模态</el-checkbox>
              <el-button
                v-if="form.models.length > 1"
                :icon="Minus"
                circle
                size="small"
                plain
                type="danger"
                @click="removeModelInput(idx)"
              />
            </div>
            <el-button size="small" plain @click="addModelInput" style="margin-top: 4px;">
              <el-icon style="margin-right:4px">
                <Plus/>
              </el-icon>
              添加模型
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="API 地址">
          <el-input v-model="form.base_url"
                    :placeholder="currentProviderPreset?.baseUrl || 'https://api.openai.com/v1'"/>
        </el-form-item>

        <el-form-item label="API Key">
          <el-input v-model="form.api_key" type="password" show-password
                    :placeholder="currentProviderPreset?.apiKeyRequired ? 'sk-...' : '可选'"/>
        </el-form-item>

        <el-form-item>
          <el-switch v-model="form.is_default" active-text="设为默认模型"/>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="handleTestModel" :loading="testing">
            <el-icon style="margin-right:4px">
              <Connection/>
            </el-icon>
            测试连接
          </el-button>
          <div>
            <el-button @click="showForm = false">取消</el-button>
            <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import {Connection, Minus, Plus} from '@element-plus/icons-vue'

interface ModelConfigRow {
  id: number
  name: string
  provider: string
  base_url: string
  api_key: string
  model: string
  models: string
  model_notes: string
  model_type: string
  is_default: number
}

interface ProviderInfo {
  id: string
  name: string
  baseUrl: string
  apiKeyRequired: boolean
  defaultModel: string
  models: string[]
}

const configs = ref<ModelConfigRow[]>([])
const providers = ref<ProviderInfo[]>([])
const showForm = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const testing = ref(false)
const activeType = ref('text')

const form = ref({
  name: '',
  provider: '',
  base_url: '',
  api_key: '',
  models: [''] as string[],
  modelMultimodal: [false] as boolean[],
  defaultModelIndex: 0,
  model_type: 'text' as string,
  is_default: false
})

const typeTabs = [
  {value: 'text', label: '对话模型', icon: '\u{1F4AC}'},
  {value: 'web_search', label: '联网搜索', icon: '\u{1F310}'}
]

// Web search providers
const WEB_SEARCH_PROVIDERS = ['perplexity', 'tavily', 'jina', 'bochaai', 'exa']

function countByType(type: string): number {
  if (type === 'text') return configs.value.filter(c => c.model_type !== 'web_search').length
  return configs.value.filter(c => c.model_type === 'web_search').length
}

const filteredConfigs = computed(() => {
  if (activeType.value === 'text') {
    return configs.value.filter(c => c.model_type !== 'web_search')
  }
  return configs.value.filter(c => c.model_type === 'web_search')
})

const currentProviderPreset = computed(() =>
  providers.value.find(p => p.id === form.value.provider)
)

// Filter providers based on model type
const filteredProviders = computed(() => {
  if (form.value.model_type === 'web_search') {
    return providers.value.filter(p => WEB_SEARCH_PROVIDERS.includes(p.id) || p.id.startsWith('custom'))
  }
  return providers.value.filter(p => !WEB_SEARCH_PROVIDERS.includes(p.id))
})

function parseModels(modelsJson: string): string[] {
  if (!modelsJson) return []
  try {
    const arr = JSON.parse(modelsJson)
    return Array.isArray(arr) ? arr.filter(Boolean) : []
  } catch {
    return []
  }
}

function parseModelNotes(notesJson: string): Record<string, string> {
  if (!notesJson) return {}
  try {
    const obj = JSON.parse(notesJson)
    return typeof obj === 'object' && obj !== null ? obj : {}
  } catch {
    return {}
  }
}

function isModelMultimodal(modelName: string, notesJson: string): boolean {
  const notes = parseModelNotes(notesJson)
  const note = notes[modelName] || ''
  return note === 'multimodal' || note.includes('\u591A\u6A21\u6001')
}

function getProviderName(id: string): string {
  return providers.value.find(p => p.id === id)?.name || id
}

const PROVIDER_ICONS: Record<string, string> = {
  ollama: '\u{1F999}', openai: '\u{1F916}', deepseek: '\u{1F40B}', qwen: '\u2601\uFE0F',
  kimi: '\u{1F319}', zhipu: '\u{1F52E}', claude: '\u{1F9E0}', doubao: '\u{1FAD8}',
  hunyuan: '\u{1F427}', ernie: '\u{1F535}', spark: '\u26A1', yi: '\u{1F30D}',
  siliconflow: '\u{1F525}', groq: '\u26A1', xiaomi: '\u{1F4F1}',
  custom: '\u2699\uFE0F', custom_anthropic: '\u{1F9E0}',
  perplexity: '\u{1F50D}', tavily: '\u{1F50E}', jina: '\u{1F310}',
  bochaai: '\u{1F4E1}', exa: '\u{1F3AF}'
}

function getProviderIcon(id: string): string {
  return PROVIDER_ICONS[id] || '\u{1F916}'
}

async function loadData() {
  configs.value = await window.electronAPI.models.list()
}

async function loadProviders() {
  providers.value = await window.electronAPI.ai.getProviders()
}

onMounted(() => {
  loadData()
  loadProviders()
})

function onModelTypeChange(type: string) {
  const list = type === 'web_search'
    ? providers.value.filter(p => WEB_SEARCH_PROVIDERS.includes(p.id) || p.id.startsWith('custom'))
    : providers.value.filter(p => !WEB_SEARCH_PROVIDERS.includes(p.id))
  if (!list.find(p => p.id === form.value.provider)) {
    form.value.provider = ''
    form.value.base_url = ''
    form.value.name = ''
    form.value.models = ['']
    form.value.modelMultimodal = [false]
    form.value.defaultModelIndex = 0
  }
}

function onProviderChange(id: string) {
  const p = providers.value.find(p => p.id === id)
  if (!p) return
  form.value.base_url = p.baseUrl
  form.value.name = p.name
  // Web search: auto-fill models from provider preset
  if (form.value.model_type === 'web_search' && p.models && p.models.length > 0) {
    form.value.models = [...p.models]
    form.value.modelMultimodal = p.models.map(() => false)
    form.value.defaultModelIndex = 0
  }
}

function addModelInput() {
  form.value.models.push('')
  form.value.modelMultimodal.push(false)
}

function removeModelInput(idx: number) {
  form.value.models.splice(idx, 1)
  form.value.modelMultimodal.splice(idx, 1)
  if (form.value.defaultModelIndex === idx) {
    form.value.defaultModelIndex = 0
  } else if (form.value.defaultModelIndex > idx) {
    form.value.defaultModelIndex--
  }
}

function openForm(cfg?: ModelConfigRow) {
  if (cfg) {
    editingId.value = cfg.id
    const parsed = parseModels(cfg.models)
    const models = parsed.length > 0 ? parsed : [cfg.model || '']
    let defaultIdx = 0
    if (cfg.model) {
      const idx = models.indexOf(cfg.model)
      if (idx >= 0) defaultIdx = idx
    }
    const notes = parseModelNotes(cfg.model_notes)
    const multimodal = models.map((m: string) =>
      notes[m] === 'multimodal' || (notes[m] || '').includes('\u591A\u6A21\u6001')
    )
    form.value = {
      name: cfg.name,
      provider: cfg.provider,
      base_url: cfg.base_url,
      api_key: cfg.api_key,
      models,
      modelMultimodal: multimodal,
      defaultModelIndex: defaultIdx,
      model_type: cfg.model_type === 'web_search' ? 'web_search' : 'text',
      is_default: !!cfg.is_default
    }
  } else {
    editingId.value = null
    const isWebSearch = activeType.value === 'web_search'
    form.value = {
      name: '',
      provider: '',
      base_url: '',
      api_key: '',
      models: [''],
      modelMultimodal: [false],
      defaultModelIndex: 0,
      model_type: isWebSearch ? 'web_search' : 'text',
      is_default: configs.value.length === 0
    }
  }
  showForm.value = true
}

async function handleTestModel() {
  let validModels = form.value.models.filter(m => m.trim())
  // For web_search, fall back to provider preset models
  if (validModels.length === 0 && form.value.model_type === 'web_search' && currentProviderPreset.value?.models?.length) {
    validModels = [...currentProviderPreset.value.models]
  }
  if (validModels.length === 0 && form.value.model_type !== 'web_search') {
    ElMessage.warning('请先填写至少一个模型名称')
    return
  }
  if (form.value.model_type === 'web_search' && !form.value.provider) {
    ElMessage.warning('请先选择服务商')
    return
  }
  const testModelName = validModels[form.value.defaultModelIndex] || validModels[0]
  testing.value = true
  try {
    const result = await window.electronAPI.models.test({
      provider: form.value.provider,
      base_url: form.value.base_url,
      api_key: form.value.api_key,
      model: testModelName
    })
    if (result.ok) {
      ElMessage.success(`\u8FDE\u63A5\u6210\u529F${result.reply ? '\uFF1A' + result.reply : ''}`)
    } else {
      ElMessage.error(`\u8FDE\u63A5\u5931\u8D25\uFF1A${result.message}`)
    }
  } catch (e: any) {
    ElMessage.error('\u6D4B\u8BD5\u5931\u8D25: ' + e.message)
  } finally {
    testing.value = false
  }
}

async function handleSave() {
  let validModels = form.value.models.filter(m => m.trim())
  // For web_search, fall back to provider preset models
  if (validModels.length === 0 && form.value.model_type === 'web_search' && currentProviderPreset.value?.models?.length) {
    validModels = [...currentProviderPreset.value.models]
  }
  if (!form.value.name) {
    ElMessage.warning('请填写名称')
    return
  }
  if (form.value.model_type !== 'web_search' && validModels.length === 0) {
    ElMessage.warning('请填写至少一个模型名称')
    return
  }
  if (form.value.model_type === 'web_search' && !form.value.provider) {
    ElMessage.warning('请选择服务商')
    return
  }
  const defaultIdx = Math.min(form.value.defaultModelIndex, validModels.length - 1)

  // Build multimodal notes from checkboxes
  const notes: Record<string, string> = {}
  for (let i = 0; i < form.value.models.length; i++) {
    const m = form.value.models[i].trim()
    if (m && form.value.modelMultimodal[i]) {
      notes[m] = 'multimodal'
    }
  }

  saving.value = true
  try {
    const data = {
      name: form.value.name,
      provider: form.value.provider,
      base_url: form.value.base_url,
      api_key: form.value.api_key,
      model: validModels[defaultIdx] || validModels[0],
      models: validModels,
      model_notes: notes,
      model_type: form.value.model_type,
      is_default: form.value.is_default
    }
    if (editingId.value) {
      await window.electronAPI.models.update(editingId.value, data)
    } else {
      await window.electronAPI.models.create(data)
    }
    showForm.value = false
    await loadData()
    ElMessage.success('\u4FDD\u5B58\u6210\u529F')
  } catch (e: any) {
    ElMessage.error('\u4FDD\u5B58\u5931\u8D25: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(cfg: ModelConfigRow) {
  try {
    await ElMessageBox.confirm(`\u786E\u5B9A\u5220\u9664\u300C${cfg.name}\u300D\uFF1F`, '\u5220\u9664\u786E\u8BA4', {type: 'warning'})
    await window.electronAPI.models.delete(cfg.id)
    await loadData()
    ElMessage.success('\u5DF2\u5220\u9664')
  } catch { /* cancel */
  }
}

async function setDefault(id: number) {
  await window.electronAPI.models.setDefault(id)
  await loadData()
}
</script>

<style scoped>
.model-config-page {
  max-width: 780px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
}

/* 类型标签页 */
.type-tabs {
  display: flex;
  gap: 6px;
  margin-bottom: 16px;
}

.type-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  color: var(--text-secondary);
  font-size: 13px;
}

.type-tab:hover {
  border-color: var(--border-color);
}

.type-tab.active {
  background: var(--color-primary-bg);
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 500;
}

.type-tab-icon {
  font-size: 16px;
}

.type-tab-count {
  background: var(--bg-secondary);
  padding: 0 6px;
  border-radius: 10px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.type-tab.active .type-tab-count {
  background: var(--color-primary);
  color: #fff;
}

/* 模型列表 */
.model-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.model-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;
}

.model-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  border-color: var(--border-color);
}

.model-card-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.model-icon {
  font-size: 28px;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 10px;
  flex-shrink: 0;
}

.model-info {
  min-width: 0;
}

.model-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}

.model-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.model-tag {
  font-size: 11px;
  cursor: default;
}

.model-tag-static {
  background: var(--bg-secondary);
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-primary);
  font-family: monospace;
  flex: 1;
}

.model-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* 表单 */
.form-row {
  display: flex;
  gap: 16px;
}

.flex-1 {
  flex: 1;
}

.model-input-list {
  width: 100%;
}

.model-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.model-list-header {
  margin-bottom: 4px;
}

.model-list-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.model-default-star {
  flex-shrink: 0;
  font-size: 20px;
  cursor: pointer;
  color: var(--text-tertiary);
  width: 24px;
  text-align: center;
  user-select: none;
  transition: color 0.2s;
}

.model-default-star:hover {
  color: var(--color-primary);
}

.model-default-star.active {
  color: #e6a23c;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.empty-hint {
  text-align: center;
  padding: 40px 0;
  color: var(--text-tertiary);
  font-size: 14px;
}
</style>
