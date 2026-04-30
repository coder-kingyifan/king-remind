<template>
  <div class="skills-tab-content">
    <!-- 过滤栏 -->
    <div class="filter-bar">
      <el-input
          v-model="searchText"
          placeholder="搜索技能..."
          prefix-icon="Search"
          clearable
          style="width: 240px;"
      />
      <el-segmented v-model="typeFilter" :options="filterOptions"/>
    </div>

    <!-- 技能列表 -->
    <div v-if="skillsStore.loading" class="state-wrap">
      <el-icon class="loading-icon" :size="26"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else-if="filteredSkills.length === 0" class="state-wrap empty">
      <div class="empty-illustration" aria-hidden="true">
        <div class="empty-gear"></div>
        <div class="empty-bolt"></div>
      </div>
      <strong>安装技能，让提醒更智能</strong>
      <p>前往技能商店安装技能，绑定后提醒触发时自动获取动态内容。</p>
      <el-button type="primary" @click="router.push('/skill-store')" style="margin-top: 12px;">
        <el-icon><ShoppingBag/></el-icon>
        浏览技能商店
      </el-button>
    </div>

    <div v-else class="skill-list">
      <div
          v-for="skill in filteredSkills"
          :key="skill.id"
          class="skill-row"
          :class="{ inactive: skill.is_active === 0 }"
      >
        <div class="row-left">
          <span class="row-icon" :style="{ background: categoryGradient(skill.category) + '20', color: categoryColor(skill.category) }">
            {{ skill.icon || '⚡' }}
          </span>
          <div class="row-info">
            <div class="row-title">{{ skill.name }}</div>
            <div class="row-meta">
              <el-tag v-if="skill.store_source" size="small" effect="plain" type="success" style="margin-right: 6px;">商店</el-tag>
              <el-tag v-else-if="skill.action_type === 'api_call'" size="small" type="success" effect="plain" style="margin-right: 6px;">API</el-tag>
              <el-tag v-else-if="skill.action_type === 'ai_prompt'" size="small" type="warning" effect="plain" style="margin-right: 6px;">AI</el-tag>
              <el-tag v-else-if="skill.action_type === 'search_and_summarize'" size="small" type="danger" effect="plain" style="margin-right: 6px;">搜索</el-tag>
              <el-tag v-else size="small" type="info" effect="plain" style="margin-right: 6px;">内置</el-tag>
              <span>{{ skill.description || '暂无描述' }}</span>
            </div>
          </div>
        </div>

        <div class="row-right">
          <el-switch
              :model-value="skill.is_enabled === 1"
              size="small"
              @change="() => handleToggleSkill(skill.id)"
          />
          <el-dropdown trigger="click" @command="(cmd: string) => handleSkillCommand(cmd, skill)">
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

    <!-- 创建/编辑技能对话框 -->
    <SkillForm
        v-model:visible="skillFormVisible"
        :skill="editingSkill"
        @saved="handleSkillSaved"
    />
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useSkillsStore} from '@/stores/skills'
import {Delete, Edit, Loading, MoreFilled, ShoppingBag} from '@element-plus/icons-vue'
import SkillForm from '@/components/skill/SkillForm.vue'
import {ElMessage, ElMessageBox} from 'element-plus'
import type {Skill} from '@/types/skill'

const router = useRouter()
const skillsStore = useSkillsStore()
const searchText = ref('')
const typeFilter = ref('all')
const skillFormVisible = ref(false)
const editingSkill = ref<Skill | null>(null)

const filterOptions = [
  {label: '全部', value: 'all'},
  {label: '内置', value: 'builtin'},
  {label: '自定义', value: 'custom'}
]

const CATEGORY_COLORS: Record<string, string> = {
  weather: '#0984e3',
  daily: '#f39c12',
  health: '#00b894',
  finance: '#e17055',
  study: '#6c5ce7',
  tools: '#00cec9',
  custom: '#e84393'
}

function categoryColor(key: string): string {
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.custom
}

function categoryGradient(key: string): string {
  return CATEGORY_COLORS[key] || CATEGORY_COLORS.custom
}

const filteredSkills = computed(() => {
  let list = skillsStore.skills
  if (typeFilter.value === 'builtin') list = list.filter(s => !s.store_source)
  else if (typeFilter.value === 'custom') list = list.filter(s => !!s.store_source)
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(s => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q))
  }
  return list
})

function openCreateDialog() {
  editingSkill.value = null
  skillFormVisible.value = true
}

function handleSkillCommand(cmd: string, skill: Skill) {
  if (cmd === 'edit') {
    editingSkill.value = skill
    skillFormVisible.value = true
  } else if (cmd === 'delete') {
    ElMessageBox.confirm(
        `确定要删除技能「${skill.name}」吗？此操作不可恢复。`,
        '删除确认',
        {confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'}
    ).then(() => {
      skillsStore.deleteSkill(skill.id)
      ElMessage.success('删除成功')
    }).catch(() => {
    })
  }
}

function handleToggleSkill(id: number) {
  skillsStore.toggleSkill(id)
}

function handleSkillSaved() {
  skillsStore.fetchSkills()
}

onMounted(() => {
  skillsStore.fetchSkills()
})

defineExpose({ openCreateDialog })
</script>

<style scoped>
.skills-tab-content {
  width: 100%;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

.row-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
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
  to { transform: rotate(360deg); }
}
</style>
