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
  <div class="p-4 bg-gray-50 min-h-screen md:p-8">
    <div class="mx-auto max-w-7xl space-y-6">
      <!-- Header -->
      <div class="flex flex-col gap-4 items-start justify-between md:flex-row md:items-center">
        <div>
          <h1 class="text-3xl text-gray-900 tracking-tight font-bold">
            排班管理系统
          </h1>
          <p class="text-gray-500 mt-1">
            四人团队周排班工具
          </p>
        </div>

        <!-- Week Navigation -->
        <div class="p-1 border border-gray-200 rounded-lg bg-white flex gap-2 shadow-sm items-center">
          <button
            class="text-gray-600 p-2 rounded-md transition-colors hover:bg-gray-100"
            @click="store.prevWeek()"
          >
            <div class="i-carbon-chevron-left text-lg" />
          </button>
          <div class="text-sm font-medium px-4 py-2 flex gap-2 items-center">
            <div class="i-carbon-calendar text-gray-400" />
            {{ store.weekDisplayText }}
          </div>
          <button
            class="text-gray-600 p-2 rounded-md transition-colors hover:bg-gray-100"
            @click="store.nextWeek()"
          >
            <div class="i-carbon-chevron-right text-lg" />
          </button>
        </div>
      </div>

      <!-- Main Content -->
      <div class="gap-6 grid grid-cols-1 lg:grid-cols-4">
        <div class="space-y-6 lg:col-span-3">
          <div class="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex flex-col gap-3 items-start justify-between sm:flex-row sm:items-center">
              <div>
                <h2 class="text-lg text-gray-900 font-semibold">
                  本周排班表
                </h2>
                <p class="text-sm text-gray-500">
                  在单元格中手动选择任务，或点击自动生成
                </p>
              </div>
              <div class="flex flex-wrap gap-2 items-center">
                <button
                  class="text-sm text-gray-700 font-medium px-3 py-1.5 border border-gray-200 rounded-lg inline-flex gap-1.5 transition-colors items-center hover:bg-gray-50"
                  @click="handleResetAll"
                >
                  <div class="i-carbon-reset text-sm" />
                  <span class="hidden sm:inline">全部重置</span>
                </button>
                <button
                  class="text-sm text-gray-700 font-medium px-3 py-1.5 border border-gray-200 rounded-lg inline-flex gap-1.5 transition-colors items-center items-center hover:bg-gray-50"
                  @click="handleResetKeepClinic"
                >
                  <div class="i-carbon-clean text-sm" />
                  <span class="hidden sm:inline">保留门诊重置</span>
                </button>
                <button
                  class="text-sm text-gray-700 font-medium px-3 py-1.5 border border-gray-200 rounded-lg inline-flex gap-1.5 transition-colors items-center hover:bg-gray-50"
                  @click="handleAutoGenerate"
                >
                  <div class="i-carbon-machine-learning-model text-sm" />
                  自动生成
                </button>
                <button
                  class="text-sm text-white font-medium px-3 py-1.5 rounded-lg bg-blue-500 inline-flex gap-1.5 transition-colors items-center hover:bg-blue-600"
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
