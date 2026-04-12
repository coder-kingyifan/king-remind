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
              <el-tag size="small" :type="modelTypeTag(cfg.model_type)" effect="plain">
                {{ modelTypeLabel(cfg.model_type) }}
              </el-tag>
            </div>
            <div class="model-meta">{{ getProviderName(cfg.provider) }} &middot; {{ cfg.base_url || '未配置' }}</div>
            <div class="model-tags" v-if="parseModels(cfg.models).length">
              <el-tooltip
                v-for="m in parseModels(cfg.models)"
                :key="m"
                :content="parseModelNotes(cfg.model_notes)[m] || ''"
                :disabled="!parseModelNotes(cfg.model_notes)[m]"
                placement="top"
              >
                <el-tag
                  size="small"
                  :type="m === cfg.model ? 'primary' : 'info'"
                  class="model-tag"
                >{{ m }}
                </el-tag>
              </el-tooltip>
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
      <p>还没有配置{{ activeType === 'all' ? '' : modelTypeLabel(activeType) }}模型，点击上方「添加模型」开始</p>
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
            <el-select v-model="form.model_type" style="width: 100%;">
              <el-option label="文本模型" value="text"/>
              <el-option label="多模态模型" value="multimodal"/>
              <el-option label="联网搜索模型" value="web_search"/>
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

        <el-form-item label="模型列表" required>
          <div class="model-input-list">
            <div class="model-list-header">
              <span class="model-list-hint">点击左侧星标设为默认模型，右侧备注可填写模型说明</span>
            </div>
            <div v-for="(m, idx) in form.models" :key="idx" class="model-input-row">
              <span
                class="model-default-star"
                :class="{ active: form.defaultModelIndex === idx }"
                @click="form.defaultModelIndex = idx"
                :title="form.defaultModelIndex === idx ? '当前默认模型' : '点击设为默认'"
              >{{ form.defaultModelIndex === idx ? '★' : '☆' }}</span>
              <el-input
                v-model="form.models[idx]"
                placeholder="输入模型名称，如 deepseek-chat"
                @keydown.enter.prevent="addModelInput"
                style="flex: 1;"
              />
              <el-input
                v-model="form.modelNotes[form.models[idx] || `__idx_${idx}__`]"
                placeholder="备注，如：多模态"
                style="width: 120px;"
              />
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
const activeType = ref('all')

const form = ref({
  name: '',
  provider: 'ollama',
  base_url: '',
  api_key: '',
  models: [''] as string[],
  modelNotes: {} as Record<string, string>,
  defaultModelIndex: 0,
  model_type: 'text' as string,
  is_default: false
})

const typeTabs = [
  {value: 'all', label: '全部模型', icon: '📦'},
  {value: 'text', label: '文本模型', icon: '💬'},
  {value: 'multimodal', label: '多模态模型', icon: '👁️'},
  {value: 'web_search', label: '联网搜索', icon: '🌐'}
]

// Web search providers
const WEB_SEARCH_PROVIDERS = ['perplexity', 'tavily', 'jina', 'bochaai', 'exa']

function modelTypeLabel(type: string): string {
  const map: Record<string, string> = {text: '文本', multimodal: '多模态', web_search: '联网搜索'}
  return map[type] || '文本'
}

function modelTypeTag(type: string): string {
  const map: Record<string, string> = {text: 'info', multimodal: 'warning', web_search: 'success'}
  return map[type] || 'info'
}

function countByType(type: string): number {
  if (type === 'all') return configs.value.length
  return configs.value.filter(c => (c.model_type || 'text') === type).length
}

const filteredConfigs = computed(() => {
  if (activeType.value === 'all') return configs.value
  return configs.value.filter(c => (c.model_type || 'text') === activeType.value)
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

function getProviderName(id: string): string {
  return providers.value.find(p => p.id === id)?.name || id
}

const PROVIDER_ICONS: Record<string, string> = {
  ollama: '🦙',
  openai: '🤖',
  deepseek: '🐋',
  qwen: '☁️',
  kimi: '🌙',
  zhipu: '🔮',
  claude: '🧠',
  doubao: '🫘',
  hunyuan: '🐧',
  ernie: '🔵',
  spark: '⚡',
  yi: '🌍',
  siliconflow: '🔥',
  groq: '⚡',
  xiaomi: '📱',
  custom: '⚙️',
  custom_anthropic: '🧠',
  perplexity: '🔍',
  tavily: '🔎',
  jina: '🌐',
  bochaai: '📡',
  exa: '🎯'
}

function getProviderIcon(id: string): string {
  return PROVIDER_ICONS[id] || '🤖'
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

function onProviderChange(id: string) {
  const p = providers.value.find(p => p.id === id)
  if (!p) return
  form.value.base_url = p.baseUrl
  form.value.name = p.name
  // Auto-detect model type from provider
  if (WEB_SEARCH_PROVIDERS.includes(id)) {
    form.value.model_type = 'web_search'
  }
}

function addModelInput() {
  form.value.models.push('')
}

function removeModelInput(idx: number) {
  form.value.models.splice(idx, 1)
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
    form.value = {
      name: cfg.name,
      provider: cfg.provider,
      base_url: cfg.base_url,
      api_key: cfg.api_key,
      models,
      modelNotes: parseModelNotes(cfg.model_notes),
      defaultModelIndex: defaultIdx,
      model_type: cfg.model_type || 'text',
      is_default: !!cfg.is_default
    }
  } else {
    editingId.value = null
    const defaultType = activeType.value === 'all' ? 'text' : activeType.value
    // Pick first provider matching the current type tab
    const typeProviders = form.value.model_type === 'web_search'
      ? filteredProviders.value
      : (defaultType === 'web_search'
          ? providers.value.filter(p => WEB_SEARCH_PROVIDERS.includes(p.id) || p.id.startsWith('custom'))
          : providers.value.filter(p => !WEB_SEARCH_PROVIDERS.includes(p.id)))
    const p = typeProviders.length > 0 ? typeProviders[0] : providers.value[0]
    form.value = {
      name: p?.name || '',
      provider: p?.id || 'ollama',
      base_url: p?.baseUrl || '',
      api_key: '',
      models: [p?.defaultModel || ''],
      modelNotes: {},
      defaultModelIndex: 0,
      model_type: defaultType,
      is_default: configs.value.length === 0
    }
  }
  showForm.value = true
}

async function handleTestModel() {
  const validModels = form.value.models.filter(m => m.trim())
  if (validModels.length === 0) {
    ElMessage.warning('请先填写至少一个模型名称')
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
      ElMessage.success(`连接成功${result.reply ? '：' + result.reply : ''}`)
    } else {
      ElMessage.error(`连接失败：${result.message}`)
    }
  } catch (e: any) {
    ElMessage.error('测试失败: ' + e.message)
  } finally {
    testing.value = false
  }
}

async function handleSave() {
  const validModels = form.value.models.filter(m => m.trim())
  if (!form.value.name || validModels.length === 0) {
    ElMessage.warning('请填写名称和至少一个模型')
    return
  }
  const defaultIdx = Math.min(form.value.defaultModelIndex, validModels.length - 1)
  const notes: Record<string, string> = {}
  for (const m of validModels) {
    const note = form.value.modelNotes[m]
    if (note && note.trim()) {
      notes[m] = note.trim()
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
    ElMessage.success('保存成功')
  } catch (e: any) {
    ElMessage.error('保存失败: ' + e.message)
  } finally {
    saving.value = false
  }
}

async function handleDelete(cfg: ModelConfigRow) {
  try {
    await ElMessageBox.confirm(`确定删除「${cfg.name}」？`, '删除确认', {type: 'warning'})
    await window.electronAPI.models.delete(cfg.id)
    await loadData()
    ElMessage.success('已删除')
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
