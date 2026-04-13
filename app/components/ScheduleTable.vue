<script setup lang="ts">
import type { DayOfWeek, StaffName, TaskInfo, TaskName } from '~/types/schedule'
import { addDays, format, parseISO } from 'date-fns'
import { DAY_LABELS, DAYS, STAFF } from '~/types/schedule'

const store = useScheduleStore()

const taskList = computed(() => (Object.values(store.taskConfigs) as TaskInfo[]).filter(t => t.name !== ''))

function getDates(): string[] {
  if (!store.schedule)
    return []
  const startDate = parseISO(store.schedule.weekStartDate)
  return DAYS.map((_, i) => format(addDays(startDate, i), 'MM-dd'))
}

function handleTaskChange(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT', event: Event) {
  const value = (event.target as HTMLSelectElement).value
  store.updateTask(person, day, period, value === '' ? '' : value as TaskName)
}

function isTaskDisabled(task: TaskInfo, period: 'AM' | 'PM' | 'NIGHT', day: DayOfWeek): boolean {
  // 特殊规则：周六基础班可以排在上午或者下午
  if (task.name === '基础班' && day === 'Saturday' && (period === 'AM' || period === 'PM'))
    return false

  if (period === 'NIGHT' && task.name !== '随访夜' && task.name !== '休假' && task.name !== '休息' && task.name !== '')
    return true
  if (task.name === '随访夜' && period !== 'NIGHT')
    return true
  if (task.period === 'ANY')
    return false
  return task.period !== period
}

function isHighlighted(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT'): boolean {
  if (!store.highlightedTasks || !store.schedule)
    return false
  const task = store.schedule.data[person][day][period]
  return store.highlightedTasks.includes(task)
}

function getCellClasses(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT'): string {
  if (!store.schedule)
    return ''
  const task = store.schedule.data[person][day][period]
  const highlighted = isHighlighted(person, day, period)

  let classes = ''

  // 1. 根据人员分配背景颜色
  switch (person) {
    case '组长': classes += 'bg-slate-100 hover:bg-slate-200 '; break
    case '成员A': classes += 'bg-green-50 hover:bg-green-100 '; break
    case '成员B': classes += 'bg-amber-50 hover:bg-amber-100 '; break
    case '成员C': classes += 'bg-violet-50 hover:bg-violet-100 '; break
    default: classes += 'bg-gray-50 hover:bg-gray-100 '; break
  }

  // 2. 规则高亮
  if (highlighted) {
    classes += 'ring-2 ring-blue-500 z-10 relative '
  }

  // 3. 根据任务类型分配文字颜色
  switch (task) {
    case '':
      classes += 'text-gray-400 font-bold opacity-70' // 未设置变淡
      break
    case '休假':
      classes += 'text-gray-400 font-medium opacity-50 line-through' // 休假变淡加删除线
      break
    case '休息':
      classes += 'text-teal-500 font-medium opacity-80' // 休息使用青色，不加删除线
      break
    case '门诊':
      classes += 'text-rose-600 font-bold'
      break
    case '随访上午':
    case '随访下午':
    case '随访夜':
      classes += 'text-blue-600 font-semibold'
      break
    case '基础班':
      classes += 'text-cyan-600 font-bold'
      break
    case '电话':
    case '筛查':
      classes += 'text-emerald-600 font-semibold'
      break
    case '运动处方':
    case '舌苔评估':
      classes += 'text-pink-600 font-semibold'
      break
    case '群石墨修改':
      classes += 'text-indigo-600 font-semibold'
      break
    default:
      classes += 'text-gray-700'
  }

  return classes
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
            rowspan="3"
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
              rowspan="3"
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
                  :disabled="isTaskDisabled(task, 'AM', day)"
                  class="text-gray-900 font-normal"
                >
                  {{ task.name }}
                </option>
              </select>
            </td>
          </tr>
          <tr class="bg-gray-50/50">
            <td class="px-2 py-1 text-center border-b border-r border-gray-100 border-gray-200 h-10">
              <span class="text-xs text-gray-400">下午</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-PM`"
              class="p-0 border-b border-r border-gray-100 border-gray-200 transition-colors duration-300 last:border-r-0"
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
                  :disabled="isTaskDisabled(task, 'PM', day)"
                  class="text-gray-900 font-normal"
                >
                  {{ task.name }}
                </option>
              </select>
            </td>
          </tr>
          <tr>
            <td class="px-2 py-1 text-center border-r border-gray-200 bg-indigo-50/30 h-10">
              <span class="text-xs text-indigo-400">晚上</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-NIGHT`"
              class="p-0 border-r border-gray-200 transition-colors duration-300 last:border-r-0"
              :class="getCellClasses(person, day, 'NIGHT')"
            >
              <select
                :value="store.schedule?.data[person][day].NIGHT || ''"
                class="text-xs text-inherit px-1 border-0 bg-transparent h-10 w-full cursor-pointer focus:outline-none focus:ring-0"
                @change="handleTaskChange(person, day, 'NIGHT', $event)"
              >
                <option value="" class="text-gray-900 font-normal">
                  未设置
                </option>
                <option
                  v-for="task in taskList"
                  :key="task.name"
                  :value="task.name"
                  :disabled="isTaskDisabled(task, 'NIGHT', day)"
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
