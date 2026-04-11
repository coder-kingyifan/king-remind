<template>
  <div class="model-config-page">
    <div class="page-header">
      <h1 class="page-title">模型配置</h1>
      <div class="page-header-actions">
        <p class="page-subtitle">管理 AI 模型，对话时可切换</p>
        <el-button type="primary" size="small" @click="openForm()">添加模型</el-button>
      </div>
    </div>

    <div class="model-list">
      <div v-for="cfg in configs" :key="cfg.id" class="model-card">
        <div class="model-header">
          <div class="model-info">
            <span class="model-icon">{{ getProviderIcon(cfg.provider) }}</span>
            <div>
              <div class="model-name">
                {{ cfg.name }}
                <el-tag v-if="cfg.is_default" size="small" type="success">默认</el-tag>
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

      <div v-if="configs.length === 0" class="empty-hint">
        <p>还没有配置模型，点击上方「添加模型」开始</p>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog
        v-model="showForm"
        :title="editingId ? '编辑模型' : '添加模型'"
        width="580px"
        :close-on-click-modal="false"
    >
      <el-form :model="form" label-position="top" size="default">
        <el-form-item label="服务商" required>
          <el-select v-model="form.provider" style="width: 100%;" filterable @change="onProviderChange">
            <el-option v-for="p in providers" :key="p.id" :label="p.name" :value="p.id"/>
          </el-select>
        </el-form-item>

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
                  @input="syncNoteKey(idx)"
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

const form = ref({
  name: '',
  provider: 'ollama',
  base_url: '',
  api_key: '',
  models: [''] as string[],
  modelNotes: {} as Record<string, string>,
  defaultModelIndex: 0,
  is_default: false
})

const currentProviderPreset = computed(() =>
    providers.value.find(p => p.id === form.value.provider)
)

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
  custom_anthropic: '🧠'
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
  form.value.name = id
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

// Keep notes in sync when model name changes
function syncNoteKey(idx: number) {
  // Notes are stored by model name key, handled in handleSave
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
      is_default: !!cfg.is_default
    }
  } else {
    editingId.value = null
    const p = providers.value[0]
    form.value = {
      name: p?.id || 'ollama',
      provider: p?.id || 'ollama',
      base_url: p?.baseUrl || '',
      api_key: '',
      models: [''],
      modelNotes: {},
      defaultModelIndex: 0,
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
  // Build model notes: map model name -> note text
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
  max-width: 720px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.page-header-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  padding: 16px 20px;
}

.model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.model-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.model-icon {
  font-size: 28px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 10px;
  flex-shrink: 0;
}

.model-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-meta {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
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
