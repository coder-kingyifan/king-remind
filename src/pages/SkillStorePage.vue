<template>
  <div class="skill-store-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">技能商店</h1>
        <p class="page-subtitle">浏览和安装社区技能，扩展你的提醒能力</p>
      </div>
      <div class="header-actions">
        <el-button @click="router.push('/reminders')">
          <el-icon>
            <ArrowLeft/>
          </el-icon>
          返回提醒管理
        </el-button>
        <el-button @click="loadStoreData" :loading="skillStoreStore.fetching">
          <el-icon>
            <Refresh/>
          </el-icon>
          刷新
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
        >全部 {{ filteredStoreSkills.length }}</span>
        <span
            v-for="cat in SKILL_CATEGORIES"
            :key="cat.key"
            class="chip"
            :class="{ active: activeCategory === cat.key }"
            @click="activeCategory = cat.key"
        >{{ cat.icon }} {{ cat.label }}</span>
      </div>
      <el-input
          v-model="searchText"
          placeholder="搜索技能..."
          prefix-icon="Search"
          clearable
          style="width: 200px;"
      />
    </div>

    <!-- 加载态 -->
    <div v-if="skillStoreStore.fetching" class="loading-state">
      <el-icon class="is-loading" :size="24">
        <Loading/>
      </el-icon>
      <span>正在从商店加载技能...</span>
    </div>

    <!-- 错误态 -->
    <div v-else-if="skillStoreStore.fetchError" class="error-state">
      <div v-if="isNetworkError" class="error-icon-svg">
        <svg viewBox="0 0 80 80" width="64" height="64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- GitHub 图标 -->
          <path
              d="M40 8C22.327 8 8 22.327 8 40c0 14.127 9.152 26.098 21.846 30.335 1.598.295 2.18-.693 2.18-1.538 0-.758-.028-3.265-.043-5.92-8.887 1.933-10.762-3.77-10.762-3.77-1.454-3.695-3.55-4.678-3.55-4.678-2.9-1.982.22-1.942.22-1.942 3.208.226 4.896 3.292 4.896 3.292 2.85 4.885 7.475 3.473 9.3 2.656.29-2.063 1.115-3.473 2.03-4.272-7.1-.808-14.565-3.55-14.565-15.82 0-3.494 1.248-6.35 3.292-8.59-.33-.808-1.426-4.064.312-8.47 0 0 2.686-.86 8.8 3.284a30.6 30.6 0 0 1 8.004-1.076c2.718.012 5.46.367 8.004 1.076 6.11-4.144 8.792-3.284 8.792-3.284 1.742 4.406.646 7.662.316 8.47 2.05 2.24 3.29 5.096 3.29 8.59 0 12.3-7.476 15.003-14.598 15.795 1.148.99 2.17 2.94 2.17 5.924 0 4.278-.04 7.724-.04 8.78 0 .852.574 1.848 2.196 1.535C62.854 66.092 72 54.122 72 40 72 22.327 57.673 8 40 8z"
              fill="currentColor" opacity="0.5"/>
          <!-- 斜杠断开线 -->
          <line x1="14" y1="66" x2="66" y2="14" stroke="#F56C6C" stroke-width="4" stroke-linecap="round"/>
        </svg>
      </div>
      <div v-else class="error-icon">⚠️</div>
      <p class="error-title">{{ isNetworkError ? '无法访问 GitHub' : '加载失败' }}</p>
      <p class="error-text">{{
          isNetworkError ? '当前无法访问 GitHub，请检查网络连接或系统设置里的网络代理' : skillStoreStore.fetchError
        }}</p>
      <el-button type="primary" @click="loadStoreData">重试</el-button>
    </div>

    <!-- 空态 -->
    <div v-else-if="filteredStoreSkills.length === 0" class="empty-state">
      <div class="empty-icon">🏪</div>
      <p class="empty-title">暂无可安装技能</p>
      <p class="empty-text">商店暂无技能或所有技能已安装</p>
    </div>

    <!-- 商店技能网格 -->
    <div v-else class="skill-grid">
      <div
          v-for="skill in filteredStoreSkills"
          :key="skill.skill_key"
          class="store-skill-card"
      >
        <div class="card-bar" :style="{ background: categoryGradient(skill.category) }"/>
        <div class="card-top">
          <div class="card-icon" :style="{ background: categoryGradient(skill.category) }">{{ skill.icon }}</div>
          <el-tag v-if="skill.installed && !skill.hasUpdate" type="success" size="small" effect="plain" round>已安装
          </el-tag>
          <el-tag v-else-if="skill.hasUpdate" type="warning" size="small" effect="plain" round>可更新</el-tag>
        </div>
        <div class="card-name">{{ skill.name }}</div>
        <div class="card-desc">{{ skill.description || '暂无描述' }}</div>
        <div class="card-tags">
          <el-tag size="small" effect="plain" round>{{ getCategoryLabel(skill.category) }}</el-tag>
          <el-tag v-if="skill.author" size="small" type="info" effect="plain" round>{{ skill.author }}</el-tag>
        </div>
        <div class="card-bottom">
          <div class="card-meta">v{{ skill.version }}</div>
          <div class="card-btns">
            <el-button
                v-if="!skill.installed"
                type="primary"
                size="small"
                @click="handleInstall(skill)"
                :loading="installingKey === skill.skill_key"
            >安装
            </el-button>
            <el-button
                v-else-if="skill.hasUpdate"
                type="warning"
                size="small"
                @click="handleUpdate(skill)"
                :loading="installingKey === skill.skill_key"
            >更新
            </el-button>
            <span v-else class="installed-text">已安装</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import {useSkillStoreStore} from '@/stores/skill-store'
import {useSkillsStore} from '@/stores/skills'
import {ArrowLeft, Loading, Refresh} from '@element-plus/icons-vue'
import type {StoreSkillWithStatus} from '@/types/skill'
import {SKILL_CATEGORIES} from '@/types/skill'
import {ElMessage} from 'element-plus'

const router = useRouter()
const skillStoreStore = useSkillStoreStore()
const skillsStore = useSkillsStore()
const searchText = ref('')
const activeCategory = ref('all')
const installingKey = ref<string | null>(null)

const isNetworkError = computed(() => {
  const err = skillStoreStore.fetchError || ''
  return err.includes('无法访问 GitHub') || err.includes('网络')
})

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

function getCategoryLabel(key: string): string {
  const cat = SKILL_CATEGORIES.find(c => c.key === key)
  return cat ? cat.label : key
}

const filteredStoreSkills = computed(() => {
  let list = skillStoreStore.storeSkills
  if (activeCategory.value !== 'all') {
    list = list.filter(s => s.category === activeCategory.value)
  }
  if (searchText.value) {
    const q = searchText.value.toLowerCase()
    list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
    )
  }
  return list
})

async function loadStoreData() {
  await skillStoreStore.fetchStoreData()
}

async function handleInstall(skill: StoreSkillWithStatus) {
  installingKey.value = skill.skill_key
  try {
    await skillStoreStore.installSkill(skill.skill_key)
    await skillsStore.refreshSkills()
    ElMessage.success(`技能「${skill.name}」安装成功`)
  } catch (e: any) {
    ElMessage.error(`安装失败: ${e.message}`)
  } finally {
    installingKey.value = null
  }
}

async function handleUpdate(skill: StoreSkillWithStatus) {
  installingKey.value = skill.skill_key
  try {
    await skillStoreStore.updateSkill(skill.skill_key)
    await skillsStore.refreshSkills()
    ElMessage.success(`技能「${skill.name}」更新成功`)
  } catch (e: any) {
    ElMessage.error(`更新失败: ${e.message}`)
  } finally {
    installingKey.value = null
  }
}

onMounted(() => {
  loadStoreData()
})
</script>

<style scoped>
.skill-store-page {
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

.store-skill-card {
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

.store-skill-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--card-accent, linear-gradient(135deg, #fd79a8, #e84393));
}

.store-skill-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.07);
  transform: translateY(-1px);
}

.card-bar {
  display: none;
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

.card-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 2px;
}

.card-meta {
  font-size: 11px;
  color: var(--text-tertiary);
}

.card-btns {
  display: flex;
  gap: 4px;
}

.installed-text {
  font-size: 12px;
  color: var(--el-color-success);
}

/* 加载态 */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 60px;
  color: var(--text-tertiary);
}

/* 错误态 */
.error-state {
  background: var(--bg-card);
  border: 1px dashed var(--border-color);
  border-radius: 12px;
  padding: 60px 40px;
  text-align: center;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-icon-svg {
  margin-bottom: 16px;
  color: var(--text-tertiary);
}

.error-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.error-text {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-bottom: 16px;
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
}
</style>
