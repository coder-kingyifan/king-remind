<template>
  <div class="skills-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">技能中心</h1>
        <p class="page-subtitle">管理和配置提醒技能，绑定技能后提醒触发时会自动获取动态内容</p>
      </div>
      <el-button type="primary" @click="openCreateDialog">
        <el-icon><Plus/></el-icon>
        新建技能
      </el-button>
    </div>

    <!-- 过滤栏 -->
    <div class="filter-bar">
      <el-input
        v-model="searchText"
        placeholder="搜索技能..."
        prefix-icon="Search"
        clearable
        style="width: 240px;"
      />
      <el-segmented v-model="activeCategory" :options="categoryOptions"/>
    </div>

    <!-- 加载态 -->
    <div v-if="skillsStore.loading" class="loading-state">
      <el-icon class="is-loading" :size="24"><Loading/></el-icon>
      <span>加载中...</span>
    </div>

    <!-- 空态 -->
    <div v-else-if="skillsStore.skills.length === 0" class="empty-state">
      <div class="empty-icon">⚡</div>
      <p class="empty-title">暂无技能</p>
      <p class="empty-text">点击"新建技能"创建您的第一个自定义技能</p>
    </div>

    <!-- 技能列表 -->
    <div v-else class="skill-list">
      <div
        v-for="skill in filteredSkills"
        :key="skill.skill_key"
        class="skill-row"
        :class="{ inactive: skill.is_enabled === 0 }"
      >
        <div class="row-left">
          <span class="row-icon">{{ skill.icon }}</span>
          <div class="row-info">
            <div class="row-title">
              {{ skill.name }}
              <el-tag v-if="skill.is_builtin" size="small" type="info" effect="plain">内置</el-tag>
              <el-tag v-else size="small" type="success" effect="plain">自定义</el-tag>
              <el-tag size="small" effect="plain" round style="margin-left: 4px;">{{ categoryLabel(skill.category) }}</el-tag>
            </div>
            <div class="row-desc">{{ skill.description }}</div>
          </div>
        </div>

        <div class="row-right">
          <el-button text size="small" @click="openConfigDialog(skill)">
            <el-icon><Setting/></el-icon>
            配置
          </el-button>
          <el-button text size="small" type="success" @click="testSkill(skill)">
            <el-icon><VideoPlay/></el-icon>
            测试
          </el-button>
          <el-switch
            :model-value="skill.is_enabled === 1"
            size="small"
            @change="() => skillsStore.toggleSkill(skill.id)"
          />
          <el-dropdown v-if="!skill.is_builtin" trigger="click" @command="(cmd: string) => handleCommand(cmd, skill)">
            <el-button text circle>
              <el-icon><MoreFilled/></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="edit">
                  <el-icon><Edit/></el-icon>
                  编辑
                </el-dropdown-item>
                <el-dropdown-item command="delete" divided>
                  <el-icon color="#F56C6C"><Delete/></el-icon>
                  <span style="color: #F56C6C;">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
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
        <el-form label-position="top" size="default">
          <el-form-item v-for="field in configFields" :key="field.key" :label="field.label">
            <el-input
              v-if="field.type === 'string'"
              v-model="configForm[field.key]"
              :placeholder="field.placeholder || ''"
            />
            <el-input-number
              v-else-if="field.type === 'number'"
              v-model="configForm[field.key]"
              style="width: 100%;"
            />
            <el-select
              v-else-if="field.type === 'select'"
              v-model="configForm[field.key]"
              style="width: 100%;"
            >
              <el-option
                v-for="opt in field.options"
                :key="String(opt.value)"
                :label="opt.label"
                :value="opt.value"
              />
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
    <SkillForm
      v-model:visible="createDialogVisible"
      :skill="editingSkill"
      @saved="handleSaved"
    />

    <!-- 测试结果对话框 -->
    <el-dialog v-if="testDialogInited" v-model="testDialogVisible" title="技能测试结果" width="500px">
      <div class="test-result">
        <div class="test-result-header">
          <span>{{ testingSkill?.icon }} {{ testingSkill?.name }}</span>
          <el-tag v-if="testResult" type="success" size="small">执行成功</el-tag>
        </div>
        <div v-if="testing" class="test-loading">
          <el-icon class="is-loading" :size="20"><Loading/></el-icon>
          <span>正在执行技能...</span>
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
import {computed, onMounted, reactive, ref} from 'vue'
import {useSkillsStore} from '@/stores/skills'
import {Delete, Edit, Loading, MoreFilled, Plus, Setting, VideoPlay} from '@element-plus/icons-vue'
import {SKILL_CATEGORIES} from '@/types/skill'
import type {Skill, SkillConfigField} from '@/types/skill'
import {ElMessage, ElMessageBox} from 'element-plus'
import SkillForm from '@/components/skill/SkillForm.vue'

const skillsStore = useSkillsStore()
const searchText = ref('')
const activeCategory = ref('all')

const categoryOptions = [
  {label: '全部', value: 'all'},
  ...SKILL_CATEGORIES.map(c => ({label: c.icon + ' ' + c.label, value: c.key}))
]

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
const testDialogInited = ref(false)
const testingSkill = ref<Skill | null>(null)
const testing = ref(false)
const testResult = ref('')

const filteredSkills = computed(() => {
  let list = skillsStore.skills
  if (activeCategory.value !== 'all') {
    list = list.filter(s => s.category === activeCategory.value)
  }
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q))
  }
  return list
})

function categoryLabel(key: string): string {
  return SKILL_CATEGORIES.find(c => c.key === key)?.label || key
}

function openConfigDialog(skill: Skill) {
  configDialogInited.value = true
  configuringSkill.value = skill
  try {
    configFields.value = JSON.parse(skill.config_schema || '[]')
  } catch {
    configFields.value = []
  }
  let userConfig: Record<string, any> = {}
  try { userConfig = JSON.parse(skill.user_config || '{}') } catch { /* ignore */ }

  for (const key of Object.keys(configForm)) delete configForm[key]
  for (const field of configFields.value) {
    configForm[field.key] = userConfig[field.key] !== undefined ? userConfig[field.key] : field.default
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

function handleCommand(cmd: string, skill: Skill) {
  if (cmd === 'edit') {
    editingSkill.value = skill
    createDialogVisible.value = true
  } else if (cmd === 'delete') {
    ElMessageBox.confirm(
      `确定要删除技能「${skill.name}」吗？`, '删除确认',
      {confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'}
    ).then(() => {
      skillsStore.deleteSkill(skill.id)
      ElMessage.success('删除成功')
    }).catch(() => {})
  }
}

function handleSaved() {
  skillsStore.refreshSkills()
}

async function testSkill(skill: Skill) {
  testDialogInited.value = true
  testingSkill.value = skill
  testDialogVisible.value = true
  testResult.value = ''
  await runTest()
}

async function runTest() {
  if (!testingSkill.value) return
  testing.value = true
  testResult.value = ''
  try {
    testResult.value = await skillsStore.executeSkill(testingSkill.value.id)
  } catch (e: any) {
    testResult.value = `执行失败: ${e.message}`
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  skillsStore.fetchSkills()
})
</script>

<style scoped>
.skills-page {
  max-width: 900px;
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

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

/* 技能列表 */
.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skill-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 10px;
  padding: 14px 18px;
  transition: all 0.2s ease;
}

.skill-row:hover {
  box-shadow: var(--shadow-md);
}

.skill-row.inactive {
  opacity: 0.55;
}

.row-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}

.row-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--color-primary-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.row-info {
  min-width: 0;
}

.row-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.row-desc {
  font-size: 12px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* 空状态 */
.empty-state {
  background: var(--bg-card);
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  padding: 60px 40px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.empty-text {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 16px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 60px;
  color: var(--text-tertiary);
}

/* 测试结果 */
.test-result {
  min-height: 80px;
}

.test-result-header {
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
