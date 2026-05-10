<template>
  <div class="thanks-page">
    <section class="support-panel">
      <div class="support-copy">
        <span class="eyebrow">感谢支持</span>
        <h1 class="page-title">每一份支持，Kingyifan都会铭记于心</h1>
        <p class="page-subtitle">如果您觉得好用，可以请 Kingyifan 喝杯咖啡；有建议或想联系我们，也可以关注公众号。</p>
      </div>
      <div class="qr-grid" aria-label="赞赏与公众号二维码">
        <button class="qr-card" type="button" @click="openTipPreview(wechatpayImg)">
          <img :src="wechatpayImg" class="qr-img" alt="微信赞赏码"/>
          <span class="qr-label">微信</span>
        </button>
        <button class="qr-card" type="button" @click="openTipPreview(alipayImg)">
          <img :src="alipayImg" class="qr-img" alt="支付宝赞赏码"/>
          <span class="qr-label">支付宝</span>
        </button>
        <button class="qr-card" type="button" @click="openTipPreview(gzhqcodeImg)">
          <img :src="gzhqcodeImg" class="qr-img" alt="公众号二维码"/>
          <span class="qr-label">公众号</span>
        </button>
      </div>
    </section>

    <section class="donation-panel">
      <div class="panel-head">
        <h2 class="section-title">赞赏墙</h2>
      </div>

      <div v-if="donations.length" class="donation-list">
        <article v-for="item in donations" :key="itemKey(item)" class="donation-row" :class="{ featured: item.highlight }">
          <div class="donation-line">
            <span class="donation-mainline">
              <a v-if="item.link" :href="item.link" target="_blank" rel="noreferrer" class="donor-name">{{ item.name }}</a>
              <span v-else class="donor-name">{{ item.name }}</span>
              <span class="donation-action">{{ item.platform ? `通过${item.platform}` : '' }}打赏：</span>
              <span class="donation-amount">{{ item.amount || '一份支持' }}</span>
            </span>
            <span v-if="item.date" class="donation-date">时间：{{ formatDateTime(item.date) }}</span>
          </div>
          <p v-if="item.message" class="donation-message">备注：{{ item.message }}</p>
        </article>
      </div>

      <div v-else class="empty-state">
        <span class="empty-title">暂时无人打赏</span>
      </div>
    </section>

    <el-dialog v-model="tipPreviewVisible" width="320px" :show-close="true" class="tip-dialog">
      <img v-if="tipPreviewSrc" :src="tipPreviewSrc" class="tip-preview-img" alt="赞赏码"/>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, onActivated, onMounted, ref} from 'vue'
import alipayImg from '@/../resources/alipay.jpg'
import wechatpayImg from '@/../resources/wechatpay.jpg'
import gzhqcodeImg from '@/../docs/gzhqcode.jpg'

interface DonationItem {
    name: string
    message?: string
    amount?: string
    date?: string
    link?: string
    platform?: string
    highlight?: boolean
}

interface AcknowledgementsData {
    updatedAt?: string
    donations: DonationItem[]
}

const REMOTE_ACKNOWLEDGEMENTS_URL = 'https://raw.githubusercontent.com/coder-kingyifan/king-mate/master/docs/acknowledgements.json'
const LOCAL_ACKNOWLEDGEMENTS_URL = '/docs/acknowledgements.json'
const REFRESH_INTERVAL = 5 * 60 * 1000

const loading = ref(false)
const lastLoadedAt = ref(0)
const acknowledgements = ref<AcknowledgementsData>(createFallbackData())
const tipPreviewVisible = ref(false)
const tipPreviewSrc = ref('')

const donations = computed(() => acknowledgements.value.donations)

function createFallbackData(): AcknowledgementsData {
    return {
        updatedAt: '2026-05-10',
        donations: []
    }
}

function itemKey(item: DonationItem) {
    return `${item.name}-${item.amount || item.date || item.message || ''}`
}

function withCacheBuster(url: string) {
    const separator = url.includes('?') ? '&' : '?'
    return `${url}${separator}t=${Date.now()}`
}

function normalizeAmount(value: unknown): string | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return `￥${value}`
    if (typeof value === 'string' && value.trim()) return value.trim()
    return undefined
}

function normalizeItem(value: unknown): DonationItem | null {
    if (!value || typeof value !== 'object') return null
    const raw = value as Record<string, unknown>
    const name = typeof raw.name === 'string' ? raw.name.trim() : ''
    if (!name) return null

    const item: DonationItem = {name}
    const amount = normalizeAmount(raw.amount)
    if (amount) item.amount = amount
    if (typeof raw.message === 'string' && raw.message.trim()) item.message = raw.message.trim()
    if (typeof raw.date === 'string' && raw.date.trim()) item.date = raw.date.trim()
    if (typeof raw.platform === 'string' && raw.platform.trim()) item.platform = raw.platform.trim()
    if (typeof raw.link === 'string' && /^https?:\/\//.test(raw.link)) item.link = raw.link
    if (typeof raw.highlight === 'boolean') item.highlight = raw.highlight
    return item
}

function normalizeItems(value: unknown): DonationItem[] {
    if (!Array.isArray(value)) return []
    return value.map(normalizeItem).filter((item): item is DonationItem => !!item)
}

function normalizeData(value: unknown): AcknowledgementsData {
    if (!value || typeof value !== 'object') {
        throw new Error('invalid acknowledgement data')
    }

    const raw = value as Record<string, unknown>
    const rawDonations = Array.isArray(raw.donations) ? raw.donations : raw.supporters
    return {
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
        donations: normalizeItems(rawDonations)
    }
}

async function fetchAcknowledgements(url: string) {
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 8000)

    try {
        const response = await fetch(withCacheBuster(url), {
            cache: 'no-store',
            signal: controller.signal
        })
        if (!response.ok) {
            throw new Error('failed to load acknowledgements')
        }
        return normalizeData(await response.json())
    } finally {
        window.clearTimeout(timer)
    }
}

async function loadAcknowledgements() {
    if (loading.value) return
    loading.value = true

    try {
        acknowledgements.value = await fetchAcknowledgements(REMOTE_ACKNOWLEDGEMENTS_URL)
    } catch {
        try {
            acknowledgements.value = await fetchAcknowledgements(LOCAL_ACKNOWLEDGEMENTS_URL)
        } catch {
            acknowledgements.value = createFallbackData()
        }
    } finally {
        lastLoadedAt.value = Date.now()
        loading.value = false
    }
}

function openTipPreview(src: string) {
    tipPreviewSrc.value = src
    tipPreviewVisible.value = true
}

function formatDateTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })
}

onMounted(loadAcknowledgements)
onActivated(() => {
    if (!lastLoadedAt.value || Date.now() - lastLoadedAt.value > REFRESH_INTERVAL) {
        loadAcknowledgements()
    }
})
</script>

<style scoped>
.thanks-page {
  max-width: 860px;
}

.support-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 28px;
  margin-bottom: 18px;
  padding: 20px;
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
}

.support-copy {
  min-width: 0;
}

.eyebrow {
  display: inline-block;
  margin-bottom: 8px;
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
}

.page-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
  font-weight: 600;
  line-height: 1.35;
}

.page-subtitle {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.qr-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(112px, 128px));
  justify-content: end;
  gap: 12px;
}

.qr-card {
  width: 128px;
  height: 154px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  color: var(--text-primary);
  cursor: pointer;
  font: inherit;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.qr-card:hover {
  border-color: rgba(64, 158, 255, 0.35);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.qr-img {
  width: 106px;
  height: 106px;
  display: block;
  object-fit: cover;
  border-radius: 6px;
  background: #fff;
}

.qr-label {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 500;
}

.donation-panel {
  background: var(--bg-card);
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  overflow: hidden;
}

.panel-head {
  padding: 14px 16px 12px;
  border-bottom: 1px solid var(--border-color-light);
}

.section-title {
  margin: 0;
  color: var(--text-primary);
  font-size: 16px;
  font-weight: 600;
}

.donation-list {
  display: flex;
  flex-direction: column;
}

.donation-row {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color-light);
}

.donation-row:last-child {
  border-bottom: none;
}

.donation-row.featured {
  background: rgba(230, 162, 60, 0.06);
}

.donation-main {
  min-width: 0;
}

.donation-line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  color: var(--text-secondary);
  font-size: 14px;
}

.donation-mainline {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 7px;
  min-width: 0;
}

.donor-name,
.donation-amount {
  color: var(--text-primary);
  font-weight: 600;
}

a.donor-name:hover {
  color: var(--color-primary);
}

.donation-action {
  color: var(--text-tertiary);
}

.donation-amount {
  color: var(--color-primary);
}

.donation-date {
  flex-shrink: 0;
  color: var(--text-tertiary);
  font-size: 12px;
}

.donation-message {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
}

.empty-state {
  min-height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22px;
  color: var(--text-tertiary);
  text-align: center;
}

.empty-title {
  color: var(--text-secondary);
  font-size: 13px;
}

.tip-preview-img {
  width: 100%;
  display: block;
  border-radius: 8px;
}

:deep(.tip-dialog .el-dialog__body) {
  padding-top: 6px;
}

@media (max-width: 760px) {
  .support-panel {
    align-items: flex-start;
    grid-template-columns: 1fr;
  }

  .qr-grid {
    grid-template-columns: repeat(auto-fit, minmax(112px, 128px));
    justify-content: start;
  }

  .donation-line {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}
</style>
