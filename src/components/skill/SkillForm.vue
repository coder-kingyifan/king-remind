<template>
  <el-dialog
    :model-value="visible"
    :title="skill ? '编辑技能' : '新建自定义技能'"
    width="540px"
    :close-on-click-modal="false"
    @update:model-value="$emit('update:visible', $event)"
    @open="onOpened"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" size="default">
      <el-form-item label="技能名称" prop="name">
        <el-input v-model="form.name" placeholder="如：汇率查询" maxlength="30" show-word-limit/>
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="简要描述技能功能" maxlength="100"/>
      </el-form-item>
      <div class="form-row">
        <el-form-item label="图标" class="form-item-sm">
          <el-popover placement="bottom-start" :width="240" trigger="click">
            <template #reference>
              <el-button plain class="icon-picker-btn">{{ form.icon }}</el-button>
            </template>
            <div class="icon-grid">
              <span
                v-for="emoji in skillEmojis"
                :key="emoji"
                class="icon-option"
                :class="{ active: form.icon === emoji }"
                @click="form.icon = emoji"
              >{{ emoji }}</span>
            </div>
          </el-popover>
        </el-form-item>
        <el-form-item label="分类" class="flex-1">
          <el-select v-model="form.category" style="width: 100%;">
            <el-option v-for="cat in categories" :key="cat.key" :label="cat.icon + ' ' + cat.label" :value="cat.key"/>
          </el-select>
        </el-form-item>
      </div>
      <el-form-item label="技能类型" prop="action_type">
        <el-radio-group v-model="form.action_type">
          <el-radio value="api_call">API 调用</el-radio>
          <el-radio value="ai_prompt">AI 提示词</el-radio>
        </el-radio-group>
        <div class="form-tip">
          {{ form.action_type === 'api_call' ? '通过 HTTP 请求获取外部数据' : '通过 AI 模型生成内容' }}
        </div>
      </el-form-item>

      <!-- API 调用配置 -->
      <template v-if="form.action_type === 'api_call'">
        <el-form-item label="API 地址" prop="api_url">
          <el-input v-model="form.api_url" placeholder="如：https://api.example.com/data"/>
        </el-form-item>
        <el-form-item label="请求方法">
          <el-radio-group v-model="form.api_method">
            <el-radio value="GET">GET</el-radio>
            <el-radio value="POST">POST</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="请求头（可选，JSON格式）">
          <el-input v-model="form.api_headers" type="textarea" :rows="2" placeholder='如：{"Authorization": "Bearer xxx"}'/>
        </el-form-item>
        <el-form-item label="响应模板（可选）">
          <el-input v-model="form.api_template" type="textarea" :rows="2" placeholder="用 {{key}} 引用返回数据中的字段"/>
        </el-form-item>
      </template>

      <!-- AI 提示词配置 -->
      <template v-if="form.action_type === 'ai_prompt'">
        <el-form-item label="提示词模板" prop="ai_prompt">
          <el-input v-model="form.ai_prompt" type="textarea" :rows="4" placeholder="如：请根据今天的日期，推荐一条适合今天的运动建议"/>
        </el-form-item>
        <div class="form-tip">
          可用变量：{&#123;date&#125;}（当前日期）、{&#123;time&#125;}（当前时间）
        </div>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        {{ skill ? '保存修改' : '创建技能' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import {useSkillsStore} from '@/stores/skills'
import {SKILL_CATEGORIES} from '@/types/skill'
import type {Skill} from '@/types/skill'
import {ElMessage} from 'element-plus'

const props = defineProps<{
  visible: boolean
  skill: Skill | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'saved'): void
}>()

const skillsStore = useSkillsStore()
const formRef = ref()
const saving = ref(false)

const categories = SKILL_CATEGORIES

const skillEmojis = [
  '⚡', '🌤️', '💬', '⏳', '💧', '📜', '🍎', '🏃', '📚', '😄',
  '⭐', '🌙', '📝', '💰', '💱', '📈', '🔧', '🎯', '🔔', '🎵',
  '🏠', '✈️', '🎮', '🎨', '📸', '🍔', '☕', '🌍', '🔬', '📊'
]

const form = ref(getDefaultForm())

const rules = {
  name: [{required: true, message: '请输入技能名称', trigger: 'blur'}],
  action_type: [{required: true, message: '请选择技能类型', trigger: 'change'}],
  api_url: [{required: true, message: '请输入 API 地址', trigger: 'blur'}],
  ai_prompt: [{required: true, message: '请输入 AI 提示词', trigger: 'blur'}]
}

function getDefaultForm() {
  return {
    name: '', description: '', icon: '⚡', category: 'custom',
    action_type: 'api_call' as 'api_call' | 'ai_prompt',
    api_url: '', api_method: 'GET', api_headers: '', api_template: '', ai_prompt: ''
  }
}

function onOpened() {
  if (props.skill) {
    let actionConfig: Record<string, any> = {}
    try { actionConfig = JSON.parse(props.skill.action_config || '{}') } catch { /* ignore */ }
    form.value = {
      name: props.skill.name, description: props.skill.description, icon: props.skill.icon,
      category: props.skill.category, action_type: props.skill.action_type as any,
      api_url: actionConfig.url || '', api_method: actionConfig.method || 'GET',
      api_headers: typeof actionConfig.headers === 'object' ? JSON.stringify(actionConfig.headers, null, 2) : (actionConfig.headers || ''),
      api_template: actionConfig.response_template || '',
      ai_prompt: actionConfig.prompt_template || actionConfig.prompt || ''
    }
  } else {
    form.value = getDefaultForm()
  }
}

async function handleSave() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      const actionConfig: Record<string, any> = {}
      if (form.value.action_type === 'api_call') {
        actionConfig.url = form.value.api_url
        actionConfig.method = form.value.api_method
        if (form.value.api_headers) {
          try { actionConfig.headers = JSON.parse(form.value.api_headers) } catch { actionConfig.headers = {} }
        }
        if (form.value.api_template) actionConfig.response_template = form.value.api_template
      } else {
        actionConfig.prompt_template = form.value.ai_prompt
      }

      const data = {
        name: form.value.name, description: form.value.description,
        icon: form.value.icon, category: form.value.category,
        action_type: form.value.action_type,
        action_config: JSON.stringify(actionConfig)
      }

      if (props.skill) {
        await skillsStore.updateSkill(props.skill.id, data)
        ElMessage.success('修改成功')
      } else {
        await skillsStore.createSkill(data)
        ElMessage.success('创建成功')
      }
      emit('update:visible', false)
      emit('saved')
    } catch (err: any) {
      ElMessage.error(err.message || '操作失败')
    } finally {
      saving.value = false
    }
  })
}
</script>

<style scoped>
.form-row {
  display: flex;
  gap: 16px;
}

.form-item-sm {
  width: auto;
}

.flex-1 {
  flex: 1;
}

.form-tip {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.icon-picker-btn {
  font-size: 20px;
  width: 40px;
  height: 40px;
  padding: 0;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.icon-option {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  font-size: 16px;
  transition: background 0.15s;
}

.icon-option:hover {
  background: var(--bg-hover);
}

.icon-option.active {
  background: var(--color-primary-bg);
}
</style>
