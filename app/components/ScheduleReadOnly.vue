<script setup lang="ts">
import type { DayOfWeek, StaffName, WeekSchedule } from '~/types/schedule'
import { addDays, format, parseISO } from 'date-fns'
import { DAY_LABELS, DAYS, STAFF } from '~/types/schedule'

const props = defineProps<{
  schedule: WeekSchedule
}>()

function getDates(): string[] {
  const startDate = parseISO(props.schedule.weekStartDate)
  return DAYS.map((_, i) => format(addDays(startDate, i), 'MM-dd'))
}

function getCellClasses(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM'): string {
  const task = props.schedule.data[person][day][period]
  switch (task) {
    case '': return 'bg-amber-100 text-amber-900 font-bold'
    case '休假': return 'bg-gray-100 text-gray-400'
    case '门诊': return 'bg-rose-50 text-rose-700 font-medium'
    case '随访上午':
    case '随访下午/夜':
    case '基础班': return 'bg-blue-50 text-blue-700 font-medium'
    case '电话':
    case '筛查': return 'bg-emerald-50 text-emerald-700 font-medium'
    case '运动处方':
    case '舌苔评估': return 'bg-purple-50 text-purple-700 font-medium'
    case '群石墨修改': return 'bg-indigo-50 text-indigo-700 font-medium'
    default: return 'bg-transparent'
  }
}
</script>

<template>
  <div class="border border-gray-200 rounded-lg bg-white overflow-x-auto">
    <table class="text-xs min-w-[600px] w-full">
      <thead>
        <tr class="bg-gray-50">
          <th class="text-gray-700 font-medium px-1 py-2 text-center border-r border-gray-200 w-[60px]" rowspan="2">
            人员
          </th>
          <th class="text-gray-700 font-medium px-1 py-2 text-center border-r border-gray-200 w-[40px]" rowspan="2">
            时段
          </th>
          <th v-for="(day, i) in DAYS" :key="day" class="px-1 py-1.5 text-center border-r border-gray-200 last:border-r-0">
            <div class="text-gray-700 font-medium">
              {{ getDates()[i] }}
            </div>
            <div class="text-[10px] text-gray-400">
              {{ DAY_LABELS[day] }}
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <template v-for="person in STAFF" :key="person">
          <tr>
            <td class="font-medium px-1 py-1 text-center align-middle border-r border-gray-200" rowspan="2">
              {{ person }}
            </td>
            <td class="px-1 py-1 text-center border-b border-r border-gray-100 border-gray-200 h-8">
              <span class="text-[10px] text-gray-400">上午</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-AM`"
              class="text-center border-b border-r border-gray-100 border-gray-200 last:border-r-0"
              :class="getCellClasses(person, day, 'AM')"
            >
              {{ props.schedule.data[person][day].AM || '未设置' }}
            </td>
          </tr>
          <tr class="bg-gray-50/50">
            <td class="px-1 py-1 text-center border-r border-gray-200 h-8">
              <span class="text-[10px] text-gray-400">下午</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-PM`"
              class="text-center border-r border-gray-200 last:border-r-0"
              :class="getCellClasses(person, day, 'PM')"
            >
              {{ props.schedule.data[person][day].PM || '未设置' }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
