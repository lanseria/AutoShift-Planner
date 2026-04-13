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

function getCellClasses(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT'): string {
  const task = props.schedule.data[person][day][period]

  let classes = ''

  // 1. 人员背景色
  switch (person) {
    case '组长': classes += 'bg-slate-100 '; break
    case '成员A': classes += 'bg-green-50 '; break
    case '成员B': classes += 'bg-amber-50 '; break
    case '成员C': classes += 'bg-violet-50 '; break
    default: classes += 'bg-gray-50 '; break
  }

  // 2. 任务文字色
  switch (task) {
    case '':
      classes += 'text-gray-400 font-bold opacity-70'
      break
    case '休假':
      classes += 'text-gray-400 font-medium opacity-50 line-through'
      break
    case '休息':
      classes += 'text-teal-500 font-medium opacity-80'
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
    <table class="text-xs min-w-[600px] w-full">
      <thead>
        <tr class="bg-gray-50">
          <th class="text-gray-700 font-medium px-1 py-2 text-center border-r border-gray-200 w-[60px]" rowspan="2">
            人员
          </th>
          <th class="text-gray-700 font-medium px-1 py-2 text-center border-r border-gray-200 w-[40px]" rowspan="3">
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
            <td class="font-medium px-1 py-1 text-center align-middle border-r border-gray-200" rowspan="3">
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
            <td class="px-1 py-1 text-center border-b border-r border-gray-100 border-gray-200 h-8">
              <span class="text-[10px] text-gray-400">下午</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-PM`"
              class="text-center border-b border-r border-gray-100 border-gray-200 last:border-r-0"
              :class="getCellClasses(person, day, 'PM')"
            >
              {{ props.schedule.data[person][day].PM || '未设置' }}
            </td>
          </tr>
          <tr class="bg-indigo-50/30">
            <td class="px-1 py-1 text-center border-r border-gray-200 h-8">
              <span class="text-[10px] text-indigo-400">晚上</span>
            </td>
            <td
              v-for="day in DAYS"
              :key="`${person}-${day}-NIGHT`"
              class="text-center border-r border-gray-200 last:border-r-0"
              :class="getCellClasses(person, day, 'NIGHT')"
            >
              {{ props.schedule.data[person][day].NIGHT || '未设置' }}
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
