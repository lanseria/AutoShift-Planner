<script setup lang="ts">
definePageMeta({
  layout: 'home',
})

const store = useScheduleStore()
const toast = useToast()
const isTaskConfigOpen = ref(false)

onMounted(() => {
  store.loadWeek()
  store.checkWeekendAlert()
})

async function handleAutoGenerate() {
  // 1. 先进行槽位预校验
  const checkRes = store.checkFeasibility()
  if (checkRes.status === 'error') {
    toast.error(checkRes.msg)
    return
  }

  if (checkRes.status === 'excess') {
    // 门诊过多，直接拦截阻断算法运行
    toast.error(checkRes.msg)
    return
  }
  else if (checkRes.status === 'short') {
    // 有空位，提示信息但不阻断
    toast.success(checkRes.msg)
  }
  else {
    // 刚好，正常提示
    toast.success(checkRes.msg)
  }

  // 2. 校验通过，执行排班算法
  const res = await store.autoGenerate()
  if (res.success)
    toast.success(res.msg)
  else
    toast.error(res.msg)
}

function handleApplyGenerated(sch: any) {
  store.applyGenerated(sch)
  toast.success('已应用所选排班方案！')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleSave() {
  store.save()
  toast.success('排班已保存到本地！')
}

function handleResetAll() {
  store.resetAll()
  toast.success('已全部重置为未设置状态')
}

function handleVerifyRules() {
  const res = store.verifyCurrentSchedule()
  if (res.valid) {
    toast.success('校验通过！当前排班表完全符合开启的规则。')
  }
  else {
    // 错误过多时截断显示
    const displayErrors = res.errors.length > 3
      ? `${res.errors.slice(0, 3).join('；')}...等共 ${res.errors.length} 处违规`
      : res.errors.join('；')
    toast.error(displayErrors)
  }
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
                  class="text-sm text-blue-700 font-medium px-3 py-1.5 border border-blue-200 rounded-lg bg-blue-50 inline-flex gap-1.5 transition-colors items-center hover:bg-blue-100"
                  @click="handleVerifyRules"
                >
                  <div class="i-carbon-spell-check text-sm" />
                  <span class="hidden sm:inline">校验规则</span>
                </button>
                <button
                  class="text-sm text-gray-700 font-medium px-3 py-1.5 border border-gray-200 rounded-lg inline-flex gap-1.5 transition-colors items-center hover:bg-gray-50"
                  @click="isTaskConfigOpen = true"
                >
                  <div class="i-carbon-settings text-sm" />
                  <span class="hidden sm:inline">任务配置</span>
                </button>
                <button
                  class="text-sm text-gray-700 font-medium px-3 py-1.5 border border-gray-200 rounded-lg inline-flex gap-1.5 transition-colors items-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="store.isGenerating"
                  @click="handleAutoGenerate"
                >
                  <div v-if="store.isGenerating" class="i-carbon-renew text-sm animate-spin" />
                  <div v-else class="i-carbon-machine-learning-model text-sm" />
                  {{ store.isGenerating ? `生成中 ${Math.round(store.progress)}%` : '自动生成' }}
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
              <!-- Progress Bar -->
              <div v-if="store.isGenerating" class="mt-4">
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-sm text-gray-600">正在搜索最优排班方案...</span>
                  <span class="text-sm text-blue-600 font-medium">{{ Math.round(store.progress) }}%</span>
                </div>
                <div class="rounded-full bg-gray-200 h-2 w-full overflow-hidden">
                  <div
                    class="rounded-full bg-blue-500 h-full transition-all duration-150 ease-linear"
                    :style="{ width: `${store.progress}%` }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Generated Candidates -->
          <div v-if="store.generatedResults" class="mt-8 animate-fade-in space-y-6">
            <div class="pb-3 border-b border-gray-200 flex items-center justify-between">
              <h2 class="text-2xl text-gray-900 font-bold">
                可选排班方案
              </h2>
              <span class="text-sm text-gray-500 font-normal ml-3 mt-1 flex-1">成员工作量差值 (组长不参与比较)</span>
              <button
                class="text-sm text-gray-500 font-medium px-3 py-1.5 rounded-lg bg-gray-100 transition-colors hover:text-gray-800 hover:bg-gray-200"
                @click="store.clearGenerated()"
              >
                取消选择
              </button>
            </div>

            <div v-for="group in store.generatedResults" :key="group.diff" class="space-y-4">
              <h3 class="text-lg text-gray-800 font-semibold flex gap-3 items-center">
                <span class="text-sm text-amber-800 font-bold px-2.5 py-1 rounded-md bg-amber-100 shadow-sm">差值 {{ group.diff.toFixed(1) }}</span>
                <span class="text-sm text-gray-500 font-normal">该差值下共有 {{ group.schedules.length }} 种方案</span>
              </h3>

              <div class="ml-2 pl-2 border-l-2 border-amber-100 gap-6 grid grid-cols-1">
                <div
                  v-for="(sch, idx) in group.schedules"
                  :key="idx"
                  class="group/item border border-blue-200 rounded-lg bg-white cursor-pointer shadow-sm transition-shadow relative overflow-hidden hover:shadow-md"
                  @click="handleApplyGenerated(sch)"
                >
                  <div class="bg-blue-500/0 flex transition-colors items-center inset-0 justify-center absolute z-20 group-hover/item:bg-blue-500/5">
                    <div class="text-white font-medium px-6 py-2 rounded-full bg-blue-600 opacity-0 shadow-lg scale-95 transform transition-all group-hover/item:opacity-100 group-hover/item:scale-100">
                      点击应用此排班
                    </div>
                  </div>
                  <div class="text-sm text-blue-800 font-medium px-4 py-2 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
                    <span>方案 {{ idx + 1 }}</span>
                    <span class="text-xs text-blue-600 font-normal opacity-70">点击表格覆盖当前排班</span>
                  </div>
                  <div class="p-4 pointer-events-none">
                    <ScheduleReadOnly :schedule="sch" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1">
          <WorkloadDashboard />
          <RulePanel />
        </div>
      </div>
    </div>

    <WeekendAlert />
    <ToastContainer />
    <TaskConfigModal v-model="isTaskConfigOpen" />
  </div>
</template>
