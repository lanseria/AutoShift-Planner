import type { DayOfWeek, StaffName, TaskName, WeekSchedule } from '~/types/schedule'
import type { ScheduleGroup } from '~/utils/algorithm'
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
    // 工作量差值只考虑成员，组长不参与比较
    const values = Object.keys(workload.value)
      .filter(p => p !== '组长')
      .map(p => workload.value[p as StaffName]) as number[]
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

  const generatedResults = ref<ScheduleGroup[] | null>(null)

  function clearGenerated() {
    generatedResults.value = null
  }

  function applyGenerated(sch: WeekSchedule) {
    schedule.value = JSON.parse(JSON.stringify(sch))
    clearGenerated()
  }

  function updateTask(person: StaffName, day: DayOfWeek, period: 'AM' | 'PM', task: TaskName) {
    if (!schedule.value)
      return
    schedule.value.data[person][day][period] = task
    clearGenerated()
  }

  function updateRestDays(person: StaffName, days: number) {
    if (!schedule.value)
      return
    if (!schedule.value.restDays) {
      schedule.value.restDays = { 组长: 2, 成员A: 2, 成员B: 2, 成员C: 2 }
    }
    schedule.value.restDays[person] = days
    clearGenerated()
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
    clearGenerated()
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
    clearGenerated()
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

  function save() {
    if (!schedule.value)
      return
    saveSchedule(schedule.value)
  }

  function goToNextWeek() {
    showWeekendAlert.value = false
    currentDate.value = addWeeks(new Date(), 1)
    loadWeek()
  }

  const highlightedTasks = ref<TaskName[] | null>(null)

  function setHighlight(tasks: TaskName[]) {
    highlightedTasks.value = tasks
  }

  function clearHighlight() {
    highlightedTasks.value = null
  }

  const activeRules = ref<string[]>([
    'daily_basic',
    'dept_mandatory',
    'fixed_tasks',
    'personal_mandatory',
    'consecutive_rest',
    'night_fatigue',
    'am_fatigue',
  ])

  function toggleRule(ruleKey: string) {
    if (activeRules.value.includes(ruleKey)) {
      activeRules.value = activeRules.value.filter(r => r !== ruleKey)
    }
    else {
      activeRules.value.push(ruleKey)
    }
  }

  function autoGenerate(): { success: boolean, msg: string } {
    if (!schedule.value)
      return { success: false, msg: '没有排班表' }

    const resultGroups = generateSchedule(schedule.value, activeRules.value)
    if (resultGroups && resultGroups.length > 0) {
      generatedResults.value = resultGroups
      const totalSchedules = resultGroups.reduce((acc, g) => acc + g.schedules.length, 0)
      return {
        success: true,
        msg: `生成成功！共找到 ${totalSchedules} 种排班方案，已按工作量差值从小到大排序。`,
      }
    }

    return {
      success: false,
      msg: '条件过于严苛或已被手动任务占满，无法找到工作量差值 ≤ 2.0 的合法排班。请微调或取消部分规则。',
    }
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
    highlightedTasks,
    activeRules,
    loadWeek,
    prevWeek,
    nextWeek,
    updateTask,
    updateRestDays,
    autoGenerate,
    save,
    resetAll,
    resetKeepClinic,
    checkWeekendAlert,
    goToNextWeek,
    setHighlight,
    clearHighlight,
    toggleRule,
    generatedResults,
    applyGenerated,
    clearGenerated,
  }
})
