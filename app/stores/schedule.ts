import type { DayOfWeek, StaffName, TaskName, WeekSchedule } from '~/types/schedule'
import { addDays, addWeeks, format, isSaturday, isSunday, parseISO, subWeeks } from 'date-fns'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DAYS, STAFF } from '~/types/schedule'
import { generateSchedule } from '~/utils/algorithm'
import { calculateWorkload, getWeekStart, loadSchedule, saveSchedule } from '~/utils/schedule'

export const useScheduleStore = defineStore('schedule', () => {
  const currentDate = ref(new Date())
  const schedule = ref<WeekSchedule | null>(null)

  const weekStartDate = computed(() => getWeekStart(currentDate.value))

  const weekDisplayText = computed(() => {
    const start = parseISO(weekStartDate.value)
    const end = addDays(start, 6)
    return `${format(start, 'yyyy年MM月dd日')} - ${format(end, 'MM月dd日')}`
  })

  const workload = computed(() => {
    if (!schedule.value)
      return {} as Record<StaffName, number>
    return calculateWorkload(schedule.value)
  })

  const isUnbalanced = computed(() => {
    const values = Object.values(workload.value) as number[]
    if (values.length === 0)
      return false
    const max = Math.max(...values)
    const min = Math.min(...values)
    return max - min > 0.5
  })

  const workloadDiff = computed(() => {
    const values = Object.values(workload.value) as number[]
    if (values.length === 0)
      return 0
    return Math.max(...values) - Math.min(...values)
  })

  const showWeekendAlert = ref(false)

  function loadWeek() {
    schedule.value = loadSchedule(weekStartDate.value)
  }

  function prevWeek() {
    currentDate.value = subWeeks(currentDate.value, 1)
    loadWeek()
  }

  function nextWeek() {
    currentDate.value = addWeeks(currentDate.value, 1)
    loadWeek()
  }

  function updateTask(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM', task: TaskName) {
    if (!schedule.value)
      return
    schedule.value.data[person][day][period] = task
  }

  function autoGenerate(): boolean {
    if (!schedule.value)
      return false
    const generated = generateSchedule(schedule.value)
    if (generated) {
      schedule.value = generated
      return true
    }
    return false
  }

  function save() {
    if (!schedule.value)
      return
    saveSchedule(schedule.value)
  }

  function resetAll() {
    if (!schedule.value)
      return
    for (const person of STAFF) {
      for (const day of DAYS) {
        schedule.value.data[person][day].AM = ''
        schedule.value.data[person][day].PM = ''
      }
    }
  }

  function resetKeepClinic() {
    if (!schedule.value)
      return
    for (const person of STAFF) {
      for (const day of DAYS) {
        if (schedule.value.data[person][day].AM !== '门诊')
          schedule.value.data[person][day].AM = ''
        if (schedule.value.data[person][day].PM !== '门诊')
          schedule.value.data[person][day].PM = ''
      }
    }
  }

  function checkWeekendAlert() {
    const today = new Date()
    if (!isSaturday(today) && !isSunday(today))
      return

    const nextWeekStart = getWeekStart(addWeeks(today, 1))
    const nextWeekSchedule = loadSchedule(nextWeekStart)

    let isEmpty = true
    for (const person of STAFF) {
      for (const day of DAYS) {
        if (nextWeekSchedule.data[person][day].AM !== '' || nextWeekSchedule.data[person][day].PM !== '') {
          isEmpty = false
          break
        }
      }
      if (!isEmpty)
        break
    }

    if (isEmpty)
      showWeekendAlert.value = true
  }

  function goToNextWeek() {
    showWeekendAlert.value = false
    currentDate.value = addWeeks(new Date(), 1)
    loadWeek()
  }

  return {
    currentDate,
    schedule,
    weekStartDate,
    weekDisplayText,
    workload,
    isUnbalanced,
    workloadDiff,
    showWeekendAlert,
    loadWeek,
    prevWeek,
    nextWeek,
    updateTask,
    autoGenerate,
    save,
    resetAll,
    resetKeepClinic,
    checkWeekendAlert,
    goToNextWeek,
  }
})
