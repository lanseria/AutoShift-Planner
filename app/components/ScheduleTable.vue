<script setup lang="ts">
import type { DayOfWeek, StaffName, TaskInfo, TaskName } from '~/types/schedule'
import { addDays, format, parseISO } from 'date-fns'
import { DAY_LABELS, DAYS, STAFF, TASKS } from '~/types/schedule'

const store = useScheduleStore()

const taskList = (Object.values(TASKS) as TaskInfo[]).filter(t => t.name !== '')

function getDates(): string[] {
  if (!store.schedule)
    return []
  const startDate = parseISO(store.schedule.weekStartDate)
  return DAYS.map((_, i) => format(addDays(startDate, i), 'MM-dd'))
}

function handleTaskChange(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM', event: Event) {
  const value = (event.target as HTMLSelectElement).value
  store.updateTask(person, day, period, value === '' ? '' : value as TaskName)
}

function isTaskDisabled(task: TaskInfo, period: 'AM' | 'PM'): boolean {
  return task.period !== 'ANY' && task.period !== period
}

function isHighlighted(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM'): boolean {
  if (!store.highlightedTasks || !store.schedule)
    return false
  const task = store.schedule.data[person][day][period]
  return store.highlightedTasks.includes(task)
}

function getCellClasses(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM'): string {
  if (!store.schedule)
    return ''
  const task = store.schedule.data[person][day][period]
  const highlighted = isHighlighted(person, day, period)

  // 1. 如果处于规则高亮状态
  if (highlighted) {
    return 'bg-blue-200 ring-2 ring-blue-500 z-10 relative text-blue-900 font-bold'
  }

  // 2. 根据任务类型分配背景色和文字颜色
  switch (task) {
    case '':
      return 'bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold' // 醒目的未设置 (预留门诊)
    case '休假':
      return 'bg-gray-100 hover:bg-gray-200 text-gray-400' // 置灰的休假
    case '门诊':
      return 'bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium' // 优先手动任务
    case '随访上午':
    case '随访下午/夜':
    case '基础班':
      return 'bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium' // 每日基础任务
    case '电话':
    case '筛查':
      return 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium' // 个人必排任务
    case '运动处方':
    case '舌苔评估':
      return 'bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium' // 部门必排任务
    case '群石墨修改':
      return 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium' // 团队固定任务
    default:
      return 'bg-transparent hover:bg-gray-50'
  }
}
</script>

<template>
  <div class="border border-gray-200 rounded-lg bg-white overflow-x-auto">
    <table v-if="store.schedule" class="text-sm min-w-800px w-full">
      <thead>
        <tr class="bg-gray-50">
          <th
            class="text-gray-700 font-medium px-2 py-3 text-center border-r border-gray-200 w-100px"
            rowspan="2"
          >
            人员
          </th>
          <th
            class="text-gray-700 font-medium px-2 py-3 text-center border-r border-gray-200 w-60px"
            rowspan="2"
          >
            时段
          </th>
          <th
            v-for="(day, i) in DAYS"
            :key="day"
            class="px-2 py-2 text-center border-r border-gray-200 last:border-r-0"
          >
            <div class="text-gray-700 font-medium">
              {{ getDates()[i] }}
            </div>
            <div class="text-xs text-gray-400">
              {{ DAY_LABELS[day] }}
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="person in STAFF" :key="person">
          <tr>
            <td
              class="font-medium px-2 py-1 text-center align-middle border-r border-gray-200"
              rowspan="2"
            >
              <div>{{ person }}</div>
              <div class="text-[11px] text-gray-500 font-normal mt-1 flex gap-0.5 items-center justify-center">
                休
                <select
                  :value="store.schedule?.restDays?.[person] ?? 2"
                  class="py-0.5 pl-0.5 pr-2 text-center appearance-none outline-none border border-gray-200 rounded bg-transparent cursor-pointer focus:border-blue-400"
                  @change="store.updateRestDays(person, Number(($event.target as HTMLSelectElement).value))"
                >
                  <option v-for="n in 8" :key="n - 1" :value="n - 1">
                    {{ n - 1 }}天
                  </option>
                </select>
              </div>
            </td>
            <td class="px-2 py-1 text-center border-b border-r border-gray-100 border-gray-200 h-10">
              <span class="text-xs text-gray-400">上午</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-AM`"
              class="p-0 border-b border-r border-gray-100 border-gray-200 transition-colors duration-300 last:border-r-0"
              :class="getCellClasses(person, day, 'AM')"
            >
              <select
                :value="store.schedule?.data[person][day].AM || ''"
                class="text-xs text-inherit px-1 border-0 bg-transparent h-10 w-full cursor-pointer focus:outline-none focus:ring-0"
                @change="handleTaskChange(person, day, 'AM', $event)"
              >
                <option value="" class="text-gray-900 font-normal">
                  未设置
                </option>
                <option
                  v-for="task in taskList"
                  :key="task.name"
                  :value="task.name"
                  :disabled="isTaskDisabled(task, 'AM')"
                  class="text-gray-900 font-normal"
                >
                  {{ task.name }}
                </option>
              </select>
            </td>
          </tr>
          <tr class="bg-gray-50/50">
            <td class="px-2 py-1 text-center border-r border-gray-200 h-10">
              <span class="text-xs text-gray-400">下午</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-PM`"
              class="p-0 border-r border-gray-200 transition-colors duration-300 last:border-r-0"
              :class="getCellClasses(person, day, 'PM')"
            >
              <select
                :value="store.schedule?.data[person][day].PM || ''"
                class="text-xs text-inherit px-1 border-0 bg-transparent h-10 w-full cursor-pointer focus:outline-none focus:ring-0"
                @change="handleTaskChange(person, day, 'PM', $event)"
              >
                <option value="" class="text-gray-900 font-normal">
                  未设置
                </option>
                <option
                  v-for="task in taskList"
                  :key="task.name"
                  :value="task.name"
                  :disabled="isTaskDisabled(task, 'PM')"
                  class="text-gray-900 font-normal"
                >
                  {{ task.name }}
                </option>
              </select>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
