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
            <span class="model-icon">🤖</span>
            <div>
              <div class="model-name">
                {{ cfg.name }}
                <el-tag v-if="cfg.is_default" size="small" type="success">默认</el-tag>
              </div>
              <div class="model-meta">{{ getProviderName(cfg.provider) }} · {{ cfg.model }}</div>
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
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" label-position="top" size="default">
        <el-form-item label="名称" required>
          <el-input v-model="form.name" placeholder="给这个模型起个名字，如：DeepSeek-V3" />
        </el-form-item>

        <el-form-item label="服务商" required>
          <el-select v-model="form.provider" style="width: 100%;" @change="onProviderChange">
            <el-option v-for="p in providers" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="API 地址">
          <el-input v-model="form.base_url" :placeholder="currentProviderPreset?.baseUrl || 'https://api.openai.com/v1'" />
        </el-form-item>

        <el-form-item label="API Key">
          <el-input v-model="form.api_key" type="password" show-password placeholder="sk-..." />
        </el-form-item>

        <el-form-item label="模型" required>
          <el-input v-model="form.model" :placeholder="currentProviderPreset?.defaultModel || 'gpt-4o-mini'" />
        </el-form-item>

        <el-form-item>
          <el-switch v-model="form.is_default" active-text="设为默认模型" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

interface ModelConfigRow {
  id: number
  name: string
  provider: string
  base_url: string
  api_key: string
  model: string
  is_default: number
}

interface ProviderInfo {
  id: string
  name: string
  baseUrl: string
  apiKeyRequired: boolean
  defaultModel: string
}

const configs = ref<ModelConfigRow[]>([])
const providers = ref<ProviderInfo[]>([])
const showForm = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)

const form = ref({
  name: '',
  provider: 'ollama',
  base_url: '',
  api_key: '',
  model: '',
  is_default: false
})

const currentProviderPreset = computed(() =>
  providers.value.find(p => p.id === form.value.provider)
)

function getProviderName(id: string): string {
  return providers.value.find(p => p.id === id)?.name || id
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
  if (!form.value.base_url) form.value.base_url = p.baseUrl
  if (!form.value.model) form.value.model = p.defaultModel
}

function openForm(cfg?: ModelConfigRow) {
  if (cfg) {
    editingId.value = cfg.id
    form.value = {
      name: cfg.name,
      provider: cfg.provider,
      base_url: cfg.base_url,
      api_key: cfg.api_key,
      model: cfg.model,
      is_default: !!cfg.is_default
    }
  } else {
    editingId.value = null
    const p = providers.value[0]
    form.value = {
      name: '',
      provider: p?.id || 'ollama',
      base_url: p?.baseUrl || '',
      api_key: '',
      model: p?.defaultModel || '',
      is_default: configs.value.length === 0
    }
  }
  showForm.value = true
}

async function handleSave() {
  if (!form.value.name || !form.value.model) {
    ElMessage.warning('请填写名称和模型')
    return
  }
  saving.value = true
  try {
    const data = JSON.parse(JSON.stringify(form.value))
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
    await ElMessageBox.confirm(`确定删除「${cfg.name}」？`, '删除确认', { type: 'warning' })
    await window.electronAPI.models.delete(cfg.id)
    await loadData()
    ElMessage.success('已删除')
  } catch { /* cancel */ }
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
  align-items: center;
  gap: 12px;
}

.model-icon {
  font-size: 28px;
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

.model-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.empty-hint {
  text-align: center;
  padding: 40px 0;
  color: var(--text-tertiary);
  font-size: 14px;
}
</style>
