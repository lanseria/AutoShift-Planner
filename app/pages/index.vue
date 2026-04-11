<script setup lang="ts">
definePageMeta({
  layout: 'home',
})

const store = useScheduleStore()
const toast = useToast()

onMounted(() => {
  store.loadWeek()
  store.checkWeekendAlert()
})

function handleAutoGenerate() {
  const success = store.autoGenerate()
  if (success)
    toast.success('自动排班成功！')
  else
    toast.error('条件过于严苛或已被手动任务占满，无法完全自动生成，请手动微调或减少预排任务。')
}

function handleSave() {
  store.save()
  toast.success('排班已保存到本地！')
}

function handleResetAll() {
  store.resetAll()
  toast.success('已全部重置为未设置状态')
}

function handleResetKeepClinic() {
  store.resetKeepClinic()
  toast.success('已重置除门诊外的所有任务')
}
</script>

<template>
  <div class="min-h-screen bg-gray-50 p-4 md:p-8">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-gray-900">
            排班管理系统
          </h1>
          <p class="text-gray-500 mt-1">
            四人团队周排班工具
          </p>
        </div>

        <!-- Week Navigation -->
        <div class="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          <button
            class="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
            @click="store.prevWeek()"
          >
            <div class="i-carbon-chevron-left text-lg" />
          </button>
          <div class="flex items-center gap-2 px-4 py-2 font-medium text-sm">
            <div class="i-carbon-calendar text-gray-400" />
            {{ store.weekDisplayText }}
          </div>
          <button
            class="p-2 rounded-md hover:bg-gray-100 transition-colors text-gray-600"
            @click="store.nextWeek()"
          >
            <div class="i-carbon-chevron-right text-lg" />
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div class="lg:col-span-3 space-y-6">
          <div class="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-gray-100 gap-3">
              <div>
                <h2 class="text-lg font-semibold text-gray-900">
                  本周排班表
                </h2>
                <p class="text-sm text-gray-500">
                  在单元格中手动选择任务，或点击自动生成
                </p>
              </div>
              <div class="flex items-center gap-2 flex-wrap">
                <button
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  @click="handleResetAll"
                >
                  <div class="i-carbon-reset text-sm" />
                  <span class="hidden sm:inline">全部重置</span>
                </button>
                <button
                  class="inline-flex items-center items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  @click="handleResetKeepClinic"
                >
                  <div class="i-carbon-clean text-sm" />
                  <span class="hidden sm:inline">保留门诊重置</span>
                </button>
                <button
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  @click="handleAutoGenerate"
                >
                  <div class="i-carbon-machine-learning-model text-sm" />
                  自动生成
                </button>
                <button
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  @click="handleSave"
                >
                  <div class="i-carbon-save text-sm" />
                  保存
                </button>
              </div>
            </div>
            <div class="p-6">
              <ScheduleTable />
            </div>
          </div>
        </div>

        <div class="lg:col-span-1">
          <WorkloadDashboard />
        </div>
      </div>
    </div>

    <WeekendAlert />
    <ToastContainer />
  </div>
</template>
