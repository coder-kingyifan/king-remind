<template>
  <div class="skills-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">技能中心</h1>
        <p class="page-subtitle">管理已启用的技能，绑定技能后提醒触发时会自动获取动态内容</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="router.push('/skill-store')">
          <el-icon><ShoppingBag/></el-icon>
          技能商店
        </el-button>
        <el-button @click="openCreateDialog">
          <el-icon><Plus/></el-icon>
          新建技能
        </el-button>
      </div>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <div class="filter-chips">
        <span
          class="chip"
          :class="{ active: activeCategory === 'all' }"
          @click="activeCategory = 'all'"
        >全部 {{ enabledCount }}</span>
        <span
          v-for="cat in SKILL_CATEGORIES"
          :key="cat.key"
          class="chip"
          :class="{ active: activeCategory === cat.key }"
          @click="activeCategory = cat.key"
        >{{ cat.icon }} {{ cat.label }}</span>
      </div>
      <div class="filter-right">
        <el-checkbox v-model="showDisabled" label="显示已禁用" size="small" />
        <el-input
          v-model="searchText"
          placeholder="搜索技能..."
          prefix-icon="Search"
          clearable
          style="width: 200px;"
        />
      </div>
    </div>

    <!-- 加载态 -->
    <div v-if="skillsStore.loading" class="state-wrap">
      <el-icon class="loading-icon" :size="26"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- 空态 -->
    <div v-else-if="filteredSkills.length === 0" class="state-wrap empty">
      <div class="empty-illustration" aria-hidden="true">
        <div class="empty-gear"></div>
        <div class="empty-bolt"></div>
      </div>
      <strong>安装技能，让提醒更智能</strong>
      <p>前往技能商店安装技能，绑定后提醒触发时自动获取动态内容。</p>
    </div>

    <!-- 技能网格 -->
    <div v-else class="skill-grid">
      <div
        v-for="skill in filteredSkills"
        :key="skill.skill_key"
        class="skill-card"
        :class="{ disabled: skill.is_enabled === 0 }"
      >
        <div class="card-bar" :style="{ background: categoryGradient(skill.category) }" />
        <div class="card-top">
          <div class="card-icon" :style="{ background: categoryGradient(skill.category) }">{{ skill.icon }}</div>
          <el-switch
            :model-value="skill.is_enabled === 1"
            size="small"
            @change="() => skillsStore.toggleSkill(skill.id)"
          />
        </div>
        <div class="card-name">{{ skill.name }}</div>
        <div class="card-desc">{{ skill.description || '暂无描述' }}</div>
        <div class="card-bottom">
          <div class="card-tags">
            <el-tag v-if="skill.store_source" size="small" effect="plain" round>商店</el-tag>
            <el-tag v-else-if="skill.action_type === 'api_call'" size="small" type="success" effect="plain" round>API</el-tag>
            <el-tag v-else-if="skill.action_type === 'ai_prompt'" size="small" type="warning" effect="plain" round>AI</el-tag>
            <el-tag v-else-if="skill.action_type === 'search_and_summarize'" size="small" type="danger" effect="plain" round>搜索</el-tag>
            <el-tag v-else size="small" type="info" effect="plain" round>自定义</el-tag>
          </div>
          <div class="card-btns">
            <span v-if="hasConfig(skill)" class="card-btn" title="配置" @click="openConfigDialog(skill)"><el-icon><Setting/></el-icon></span>
            <span class="card-btn" title="测试" @click="testSkill(skill)"><el-icon><VideoPlay/></el-icon></span>
            <span v-if="!skill.store_source" class="card-btn" title="编辑" @click="editSkill(skill)"><el-icon><Edit/></el-icon></span>
            <span class="card-btn danger" title="删除" @click="deleteSkill(skill)"><el-icon><Delete/></el-icon></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 配置对话框 -->
    <el-dialog
      v-if="configDialogInited"
      v-model="configDialogVisible"
      :title="`配置 - ${configuringSkill?.name || ''}`"
      width="480px"
      :close-on-click-modal="false"
    >
      <div v-if="configFields.length > 0">
        <el-form label-position="top">
          <el-form-item v-for="field in configFields" :key="field.key" :label="field.label">
            <el-input v-if="field.type === 'string'" v-model="configForm[field.key]" :placeholder="field.placeholder || ''" />
            <el-input-number v-else-if="field.type === 'number'" v-model="configForm[field.key]" style="width: 100%;" />
            <el-select v-else-if="field.type === 'select'" v-model="configForm[field.key]" style="width: 100%;">
              <el-option v-for="opt in field.options" :key="String(opt.value)" :label="opt.label" :value="opt.value" />
            </el-select>
          </el-form-item>
        </el-form>
      </div>
      <div v-else>
        <el-empty description="该技能无需额外配置" :image-size="60"/>
      </div>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">保存配置</el-button>
      </template>
    </el-dialog>

    <!-- 创建/编辑对话框 -->
    <SkillForm v-if="createDialogVisible" v-model:visible="createDialogVisible" :skill="editingSkill" @saved="handleSaved" />

    <!-- 测试结果对话框 -->
    <el-dialog v-if="testDialogVisible" v-model="testDialogVisible" title="技能测试结果" width="500px">
      <div class="test-result">
        <div class="test-header">
          <span>{{ testingSkill?.icon }} {{ testingSkill?.name }}</span>
          <el-tag v-if="testResult" type="success" size="small">成功</el-tag>
        </div>
        <div v-if="testing" class="test-loading">
          <el-icon class="is-loading" :size="20"><Loading/></el-icon>
          <span>执行中...</span>
        </div>
        <div v-else-if="testResult" class="test-content">{{ testResult }}</div>
      </div>
      <template #footer>
        <el-button @click="testDialogVisible = false">关闭</el-button>
        <el-button type="primary" @click="runTest">再次测试</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, onActivated, onMounted, reactive, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useSkillsStore} from '@/stores/skills'
import {Delete, Edit, Loading, Plus, Setting, ShoppingBag, VideoPlay} from '@element-plus/icons-vue'
import {SKILL_CATEGORIES} from '@/types/skill'
import type {Skill, SkillConfigField} from '@/types/skill'
import {ElMessage, ElMessageBox} from 'element-plus'
import SkillForm from '@/components/skill/SkillForm.vue'

const router = useRouter()
const skillsStore = useSkillsStore()
const searchText = ref('')
const activeCategory = ref('all')
const showDisabled = ref(false)

const GRADIENTS: Record<string, string> = {
  weather: 'linear-gradient(135deg, #74b9ff, #0984e3)',
  daily: 'linear-gradient(135deg, #ffeaa7, #f39c12)',
  health: 'linear-gradient(135deg, #55efc4, #00b894)',
  finance: 'linear-gradient(135deg, #fab1a0, #e17055)',
  study: 'linear-gradient(135deg, #a29bfe, #6c5ce7)',
  tools: 'linear-gradient(135deg, #81ecec, #00cec9)',
  custom: 'linear-gradient(135deg, #fd79a8, #e84393)'
}
function categoryGradient(key: string): string {
  return GRADIENTS[key] || GRADIENTS.custom
}

const enabledCount = computed(() => skillsStore.skills.filter(s => s.is_enabled === 1).length)

const filteredSkills = computed(() => {
  let list = skillsStore.skills
  // 默认只显示已启用的技能
  if (!showDisabled.value) {
    list = list.filter(s => s.is_enabled === 1)
  }
  if (activeCategory.value !== 'all') {
    list = list.filter(s => s.category === activeCategory.value)
  }
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
  }
  return list
})

// 配置对话框
const configDialogVisible = ref(false)
const configDialogInited = ref(false)
const configuringSkill = ref<Skill | null>(null)
const configForm = reactive<Record<string, any>>({})
const configFields = ref<SkillConfigField[]>([])

// 创建/编辑
const createDialogVisible = ref(false)
const editingSkill = ref<Skill | null>(null)

// 测试
const testDialogVisible = ref(false)
const testingSkill = ref<Skill | null>(null)
const testing = ref(false)
const testResult = ref('')

function hasConfig(skill: Skill): boolean {
  try {
    const fields = JSON.parse(skill.config_schema || '[]')
    return Array.isArray(fields) && fields.length > 0
  } catch {
    return false
  }
}

function openConfigDialog(skill: Skill) {
  configDialogInited.value = true
  configuringSkill.value = skill
  try {
    configFields.value = JSON.parse(skill.config_schema || '[]')
  } catch {
    configFields.value = []
  }
  let uc: Record<string, any> = {}
  try { uc = JSON.parse(skill.user_config || '{}') } catch { /* ignore */ }
  for (const key of Object.keys(configForm)) delete configForm[key]
  for (const field of configFields.value) {
    configForm[field.key] = uc[field.key] !== undefined ? uc[field.key] : field.default
  }
  configDialogVisible.value = true
}

async function saveConfig() {
  if (!configuringSkill.value) return
  await skillsStore.updateConfig(configuringSkill.value.id, JSON.stringify({...configForm}))
  configDialogVisible.value = false
  ElMessage.success('配置已保存')
}

function openCreateDialog() {
  editingSkill.value = null
  createDialogVisible.value = true
}

function editSkill(skill: Skill) {
  editingSkill.value = skill
  createDialogVisible.value = true
}

function deleteSkill(skill: Skill) {
  ElMessageBox.confirm(
    `确定要删除技能「${skill.name}」吗？`, '删除确认',
    {confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'}
  ).then(() => {
    skillsStore.deleteSkill(skill.id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

function handleSaved() {
  skillsStore.refreshSkills()
}

async function testSkill(skill: Skill) {
  // AI 相关技能需要检查模型配置
  if (skill.action_type === 'ai_prompt' || skill.action_type === 'search_and_summarize') {
    const hasModel = await window.electronAPI.models.hasTextModel()
    if (!hasModel) {
      ElMessage.warning('尚未配置文本模型，请先前往「模型配置」页面添加模型')
      return
    }
  }
  if (skill.action_type === 'search_and_summarize') {
    const hasSearch = await window.electronAPI.models.hasSearchModel()
    if (!hasSearch) {
      ElMessage.warning('您还没有配置联网搜索模型，请先前往「模型配置」页面添加')
      return
    }
  }
  testingSkill.value = skill
  testResult.value = ''
  testing.value = true
  testDialogVisible.value = true
  try {
    testResult.value = await skillsStore.executeSkill(skill.id, {skipEnabledCheck: true})
  } catch (e: any) {
    testResult.value = `执行失败: ${e.message}`
  } finally {
    testing.value = false
  }
}

async function runTest() {
  if (!testingSkill.value) return
  // AI 相关技能需要检查模型配置
  if (testingSkill.value.action_type === 'ai_prompt' || testingSkill.value.action_type === 'search_and_summarize') {
    const hasModel = await window.electronAPI.models.hasTextModel()
    if (!hasModel) {
      ElMessage.warning('尚未配置文本模型，请先前往「模型配置」页面添加模型')
      return
    }
  }
  if (testingSkill.value.action_type === 'search_and_summarize') {
    const hasSearch = await window.electronAPI.models.hasSearchModel()
    if (!hasSearch) {
      ElMessage.warning('您还没有配置联网搜索模型，请先前往「模型配置」页面添加')
      return
    }
  }
  testing.value = true
  testResult.value = ''
  try {
    testResult.value = await skillsStore.executeSkill(testingSkill.value.id, {skipEnabledCheck: true})
  } catch (e: any) {
    testResult.value = `执行失败: ${e.message}`
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  skillsStore.fetchSkills()
})

onActivated(() => {
  skillsStore.refreshSkills()
})
</script>

<style scoped>
.skills-page {
  max-width: 960px;
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

.header-actions {
  display: flex;
  gap: 8px;
}

/* 过滤栏 */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.filter-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 16px;
  font-size: 12px;
  cursor: pointer;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  color: var(--text-secondary);
  transition: all 0.15s;
  user-select: none;
}

.chip:hover {
  border-color: var(--color-primary, #409EFF);
  color: var(--color-primary, #409EFF);
}

.chip.active {
  background: var(--color-primary, #409EFF);
  border-color: var(--color-primary, #409EFF);
  color: #fff;
}

/* 技能网格 */
.skill-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.skill-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: box-shadow 0.2s, transform 0.2s;
  position: relative;
  overflow: hidden;
}

.skill-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--card-accent, linear-gradient(135deg, #fd79a8, #e84393));
}

.skill-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
  transform: translateY(-1px);
}

.skill-card.disabled {
  opacity: 0.45;
}

.skill-card.disabled:hover {
  transform: none;
  box-shadow: none;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.card-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.card-bar {
  display: none; /* using ::before pseudo instead */
}

.card-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.card-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.card-tags {
  display: flex;
  gap: 4px;
}

.card-btns {
  display: flex;
  gap: 2px;
}

.card-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-tertiary);
  transition: all 0.15s;
  font-size: 14px;
}

.card-btn:hover {
  background: var(--bg-hover);
  color: var(--color-primary, #409EFF);
}

.card-btn.danger:hover {
  color: #F56C6C;
}

/* 空/加载状态 */
.state-wrap {
  display: flex;
  min-height: 420px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px 84px;
  color: var(--text-tertiary);
  font-size: 13px;
  text-align: center;
}

.loading-icon {
  margin-bottom: 10px;
  animation: rotate 1s linear infinite;
}

.empty strong {
  margin-top: 16px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 700;
}

.empty p {
  margin-top: 8px;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.empty-illustration {
  position: relative;
  width: 112px;
  height: 100px;
}

.empty-gear {
  position: absolute;
  left: 14px;
  top: 18px;
  width: 44px;
  height: 44px;
  border: 3px solid rgba(108, 92, 231, .4);
  border-radius: 50%;
  background: rgba(108, 92, 231, .06);
}

.empty-gear::before {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  border: 2.5px solid rgba(108, 92, 231, .4);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  content: '';
}

.empty-gear::after {
  position: absolute;
  top: -6px;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: rgba(108, 92, 231, .35);
  transform: translateX(-50%);
  box-shadow:
    22px 12px 0 rgba(108, 92, 231, .35),
    22px 34px 0 rgba(108, 92, 231, .35),
    0px 44px 0 rgba(108, 92, 231, .35),
    -22px 34px 0 rgba(108, 92, 231, .35),
    -22px 12px 0 rgba(108, 92, 231, .35);
  content: '';
}

.empty-bolt {
  position: absolute;
  right: 12px;
  bottom: 16px;
  width: 28px;
  height: 44px;
  background: rgba(253, 121, 168, .35);
  clip-path: polygon(40% 0%, 100% 0%, 30% 45%, 65% 45%, 0% 100%, 25% 55%, 0% 55%);
}

@keyframes rotate {
  to {
    transform: rotate(360deg);
  }
}

/* 测试结果 */
.test-result { min-height: 80px; }
.test-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-weight: 600;
}
.test-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 30px;
  color: var(--text-tertiary);
}
.test-content {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  padding: 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
}
</style>
