<script setup lang="ts">
import { addDays, format, parseISO } from 'date-fns'
import type { DayOfWeek, StaffName, TaskName, TaskInfo } from '~/types/schedule'
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
</script>

<template>
  <div class="border border-gray-200 rounded-lg overflow-x-auto bg-white">
    <table v-if="store.schedule" class="min-w-800px w-full text-sm">
      <thead>
        <tr class="bg-gray-50">
          <th
            class="w-100px border-r border-gray-200 text-center px-2 py-3 font-medium text-gray-700"
            rowspan="2"
          >
            人员
          </th>
          <th
            class="w-60px border-r border-gray-200 text-center px-2 py-3 font-medium text-gray-700"
            rowspan="2"
          >
            时段
          </th>
          <th
            v-for="(day, i) in DAYS"
            :key="day"
            class="text-center border-r border-gray-200 last:border-r-0 px-2 py-2"
          >
            <div class="font-medium text-gray-700">
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
              class="font-medium border-r border-gray-200 text-center align-middle px-2 py-1"
              rowspan="2"
            >
              {{ person }}
            </td>
            <td class="border-r border-gray-200 text-center px-2 py-1 h-10 border-b border-gray-100">
              <span class="text-xs text-gray-400">上午</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-AM`"
              class="p-0 border-r border-gray-200 last:border-r-0 border-b border-gray-100"
            >
              <select
                :value="store.schedule?.data[person][day].AM || ''"
                class="w-full h-10 text-xs border-0 bg-transparent hover:bg-gray-50 focus:ring-0 focus:outline-none cursor-pointer px-1"
                @change="handleTaskChange(person, day, 'AM', $event)"
              >
                <option value="">
                  未设置
                </option>
                <option
                  v-for="task in taskList"
                  :key="task.name"
                  :value="task.name"
                  :disabled="isTaskDisabled(task, 'AM')"
                >
                  {{ task.name }}
                </option>
              </select>
            </td>
          </tr>
          <tr class="bg-gray-50/50">
            <td class="border-r border-gray-200 text-center px-2 py-1 h-10">
              <span class="text-xs text-gray-400">下午</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-PM`"
              class="p-0 border-r border-gray-200 last:border-r-0"
            >
              <select
                :value="store.schedule?.data[person][day].PM || ''"
                class="w-full h-10 text-xs border-0 bg-transparent hover:bg-gray-50 focus:ring-0 focus:outline-none cursor-pointer px-1"
                @change="handleTaskChange(person, day, 'PM', $event)"
              >
                <option value="">
                  未设置
                </option>
                <option
                  v-for="task in taskList"
                  :key="task.name"
                  :value="task.name"
                  :disabled="isTaskDisabled(task, 'PM')"
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
