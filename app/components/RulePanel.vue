<script setup lang="ts">
import type { TaskName } from '~/types/schedule'
import { ref } from 'vue'

const store = useScheduleStore()
const isTaskConfigOpen = ref(false)

interface SubRule {
  key: string
  label: string
}

interface Rule {
  key: string | null
  label: string
  desc: string
  tasks: TaskName[]
  subRules?: SubRule[]
}

const rules: Rule[] = [
  { key: 'daily_basic', label: '每日基础', desc: '每天必有 1个随访上午、1个随访下午、1个随访夜、1个基础班，且单人一天最多排一种随访', tasks: ['随访上午', '随访下午', '随访夜', '基础班'] },
  { key: 'dept_mandatory', label: '部门必排', desc: '每周整个团队需完成 1次运动处方、1次舌苔评估', tasks: ['运动处方', '舌苔评估'] },
  { key: 'fixed_tasks', label: '固定任务', desc: '周四下午 2人、周六下午 1人 负责群石墨修改', tasks: ['群石墨修改'] },
  { key: 'personal_mandatory', label: '个人必排', desc: '每个人每周只能排 1次电话、1次筛查，不能多不能少', tasks: ['电话', '筛查'] },
  { key: 'consecutive_rest', label: '连休规则', desc: '每人每周必须有2天全天休息 (连续2天，或周一+周日跨周)', tasks: ['休假'] },
  {
    key: null,
    label: '夜班防疲劳',
    desc: '排随访夜后，次日上午不能安排：',
    tasks: [],
    subRules: [
      { key: 'night_fatigue_sfam', label: '随访上午' },
      { key: 'night_fatigue_stpg', label: '舌苔评估' },
      { key: 'night_fatigue_mz', label: '门诊' },
    ],
  },
  { key: 'am_fatigue', label: '上午防疲劳', desc: '门诊、随访上午、舌苔评估 不可连续两天排在上午', tasks: ['门诊', '随访上午', '舌苔评估'] },
]
</script>

<template>
  <div class="border border-gray-200 rounded-lg bg-white w-full overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
      <h3 class="text-lg text-gray-900 font-semibold flex gap-2 items-center">
        <div class="i-carbon-rule text-blue-500" />
        排班规则说明
      </h3>
      <button
        class="text-sm text-gray-700 font-medium px-3 py-1.5 border border-gray-200 rounded-lg inline-flex gap-1.5 transition-colors items-center hover:bg-gray-50"
        @click="isTaskConfigOpen = true"
      >
        <div class="i-carbon-settings text-sm" />
        <span class="hidden sm:inline">任务配置</span>
      </button>
    </div>
    <div class="p-2">
      <div class="flex flex-col gap-1">
        <div
          v-for="rule in rules"
          :key="rule.label"
          class="group px-3 py-2 rounded-md flex gap-3 transition-colors items-start hover:bg-blue-50"
        >
          <div v-if="rule.key" class="mt-0.5">
            <input
              type="checkbox"
              :checked="store.activeRules.includes(rule.key)"
              class="text-blue-600 rounded cursor-pointer focus:ring-blue-500"
              @change="store.toggleRule(rule.key)"
            >
          </div>
          <div v-else class="mt-0.5 w-4" />

          <div class="flex-1">
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-800 font-medium transition-colors group-hover:text-blue-700" :class="rule.key && !store.activeRules.includes(rule.key) ? 'text-gray-400 line-through' : ''">
                {{ rule.label }}
              </span>
              <div v-if="rule.tasks.length" class="flex gap-1">
                <span
                  v-for="task in rule.tasks"
                  :key="task"
                  class="text-[10px] text-gray-500 px-1.5 py-0.5 rounded bg-gray-100 transition-colors group-hover:text-blue-600 group-hover:bg-blue-100"
                >
                  {{ task || '未设置' }}
                </span>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-1" :class="rule.key && !store.activeRules.includes(rule.key) ? 'opacity-50' : ''">
              {{ rule.desc }}
            </p>

            <div v-if="rule.subRules" class="mt-2.5 p-2 border border-gray-100 rounded bg-white flex flex-wrap gap-4">
              <label v-for="sub in rule.subRules" :key="sub.key" class="flex gap-1.5 cursor-pointer items-center">
                <input type="checkbox" :checked="store.activeRules.includes(sub.key)" class="text-blue-600 rounded focus:ring-blue-500" @change="store.toggleRule(sub.key)">
                <span class="text-xs text-gray-700" :class="store.activeRules.includes(sub.key) ? '' : 'text-gray-400 line-through'">{{ sub.label }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <TaskConfigModal v-model="isTaskConfigOpen" />
</template>
