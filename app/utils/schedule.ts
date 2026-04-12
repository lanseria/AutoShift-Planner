import type { DaySchedule, PersonSchedule, StaffName, WeekSchedule } from '~/types/schedule'
import { format, startOfWeek } from 'date-fns'
import { DAYS, STAFF, TASKS } from '~/types/schedule'

export function getEmptyPersonSchedule(): PersonSchedule {
  const schedule = {} as PersonSchedule
  for (const day of DAYS)
    schedule[day] = { AM: '', PM: '' } as DaySchedule

  return schedule
}

export function getEmptyWeekSchedule(weekStartDate: string): WeekSchedule {
  const data = {} as Record<StaffName, PersonSchedule>
  for (const person of STAFF)
    data[person] = getEmptyPersonSchedule()

  return {
    weekStartDate,
    data,
    restDays: { 朱克捷: 2, 高琪: 2, 李敏欣: 2, 杨秀芬: 2 },
  }
}

export function getWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function getScheduleKey(weekStartDate: string): string {
  return `schedule_${weekStartDate}`
}

export function loadSchedule(weekStartDate: string): WeekSchedule {
  const key = getScheduleKey(weekStartDate)
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as WeekSchedule
      if (!parsed.restDays) {
        parsed.restDays = { 朱克捷: 2, 高琪: 2, 李敏欣: 2, 杨秀芬: 2 }
      }
      return parsed
    }
    catch (e) {
      console.error('Failed to parse schedule', e)
    }
  }
  return getEmptyWeekSchedule(weekStartDate)
}

export function saveSchedule(schedule: WeekSchedule): void {
  const key = getScheduleKey(schedule.weekStartDate)
  localStorage.setItem(key, JSON.stringify(schedule))
}

export function calculateWorkload(schedule: WeekSchedule): Record<StaffName, number> {
  const workload = {} as Record<StaffName, number>
  for (const person of STAFF) {
    let total = 0
    for (const day of DAYS) {
      const amTask = schedule.data[person][day].AM
      const pmTask = schedule.data[person][day].PM
      if (amTask)
        total += TASKS[amTask].weight
      if (pmTask)
        total += TASKS[pmTask].weight
    }
    workload[person] = total
  }
  return workload
}
