import { format, subWeeks, parseISO } from 'date-fns'
import type { DayOfWeek, StaffName, TaskName, WeekSchedule } from '~/types/schedule'
import { DAYS, STAFF } from '~/types/schedule'
import { loadSchedule } from './schedule'

export const isEmptyOrRest = (task: TaskName): boolean => task === '' || task === '休假'

interface PrevWeekContext {
  sundayAM: Record<StaffName, TaskName>
  sundayPM: Record<StaffName, TaskName>
  saturdayEmpty: Record<StaffName, boolean>
  sundayEmpty: Record<StaffName, boolean>
}

function getPrevWeekContext(weekStartDate: string): PrevWeekContext {
  const prevWeekDate = format(subWeeks(parseISO(weekStartDate), 1), 'yyyy-MM-dd')
  const prevSchedule = loadSchedule(prevWeekDate)

  const context = {
    sundayAM: {} as Record<StaffName, TaskName>,
    sundayPM: {} as Record<StaffName, TaskName>,
    saturdayEmpty: {} as Record<StaffName, boolean>,
    sundayEmpty: {} as Record<StaffName, boolean>,
  }

  for (const person of STAFF) {
    const sat = prevSchedule.data[person].Saturday
    const sun = prevSchedule.data[person].Sunday

    context.sundayAM[person] = sun.AM
    context.sundayPM[person] = sun.PM
    context.saturdayEmpty[person] = isEmptyOrRest(sat.AM) && isEmptyOrRest(sat.PM)
    context.sundayEmpty[person] = isEmptyOrRest(sun.AM) && isEmptyOrRest(sun.PM)
  }

  return context
}

const isAMFatigueTask = (task: TaskName): boolean => {
  return task === '随访上午' || task === '舌苔评估' || task === '门诊'
}

function getPrevDay(day: DayOfWeek): DayOfWeek | null {
  const idx = DAYS.indexOf(day)
  return idx > 0 ? DAYS[idx - 1]! : null
}

function getNextDay(day: DayOfWeek): DayOfWeek | null {
  const idx = DAYS.indexOf(day)
  return idx < DAYS.length - 1 ? DAYS[idx + 1]! : null
}

export function generateSchedule(currentSchedule: WeekSchedule): WeekSchedule | null {
  const context = getPrevWeekContext(currentSchedule.weekStartDate)

  const isManual = (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM'): boolean => {
    return currentSchedule.data[person][day][period] !== ''
  }

  const MAX_ATTEMPTS = 1000

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const newSchedule: WeekSchedule = JSON.parse(JSON.stringify(currentSchedule))
    if (tryGenerate(newSchedule, context, isManual)) {
      for (const p of STAFF) {
        delete (newSchedule as any)[`_rest_${p}`]
        for (const d of DAYS) {
          if (newSchedule.data[p][d].AM === '')
            newSchedule.data[p][d].AM = '休假'
          if (newSchedule.data[p][d].PM === '')
            newSchedule.data[p][d].PM = '休假'
        }
      }
      return newSchedule
    }
  }

  return null
}

function getRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, n)
}

function tryGenerate(
  schedule: WeekSchedule,
  context: PrevWeekContext,
  isManual: (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM') => boolean,
): boolean {
  // 1. Assign Fixed Tasks
  // Fixed: Thu PM (2 群石墨修改), Sat PM (1 群石墨修改)
  let thuPMCount = 0
  for (const p of STAFF) {
    if (schedule.data[p].Thursday.PM === '群石墨修改')
      thuPMCount++
  }
  if (thuPMCount < 2) {
    const candidates = STAFF.filter(p => !isManual(p, 'Thursday', 'PM') && schedule.data[p].Thursday.PM === '')
    if (candidates.length < 2 - thuPMCount)
      return false
    const chosen = getRandom(candidates, 2 - thuPMCount)
    for (const p of chosen)
      schedule.data[p].Thursday.PM = '群石墨修改'
  }

  // Assign Fixed: Sat PM
  let satPMCount = 0
  for (const p of STAFF) {
    if (schedule.data[p].Saturday.PM === '群石墨修改')
      satPMCount++
  }
  if (satPMCount < 1) {
    const candidates = STAFF.filter(p => !isManual(p, 'Saturday', 'PM') && schedule.data[p].Saturday.PM === '')
    if (candidates.length < 1 - satPMCount)
      return false
    const chosen = getRandom(candidates, 1 - satPMCount)
    for (const p of chosen)
      schedule.data[p].Saturday.PM = '群石墨修改'
  }

  // Assign Dept: 运动处方 (PM)
  let hasYundong = false
  for (const d of DAYS) {
    for (const p of STAFF) {
      if (schedule.data[p][d].PM === '运动处方')
        hasYundong = true
    }
  }
  if (!hasYundong) {
    const pmSlots: { p: StaffName, d: DayOfWeek }[] = []
    for (const d of DAYS) {
      for (const p of STAFF) {
        if (!isManual(p, d, 'PM') && schedule.data[p][d].PM === '')
          pmSlots.push({ p, d })
      }
    }
    if (pmSlots.length === 0)
      return false
    const chosen = getRandom(pmSlots, 1)
    if (chosen.length === 0)
      return false
    schedule.data[chosen[0]!.p][chosen[0]!.d].PM = '运动处方'
  }

  // Assign Dept: 舌苔评估 (AM)
  let hasShetai = false
  for (const d of DAYS) {
    for (const p of STAFF) {
      if (schedule.data[p][d].AM === '舌苔评估')
        hasShetai = true
    }
  }
  if (!hasShetai) {
    const amSlots: { p: StaffName, d: DayOfWeek }[] = []
    for (const d of DAYS) {
      for (const p of STAFF) {
        if (!isManual(p, d, 'AM') && schedule.data[p][d].AM === '') {
          const prevDay = getPrevDay(d)
          const nextDay = getNextDay(d)
          const prevAM = prevDay ? schedule.data[p][prevDay].AM : context.sundayAM[p]
          const nextAM = nextDay ? schedule.data[p][nextDay].AM : '' as TaskName

          if (!isAMFatigueTask(prevAM) && !isAMFatigueTask(nextAM))
            amSlots.push({ p, d })
        }
      }
    }
    if (amSlots.length === 0)
      return false
    const chosen = getRandom(amSlots, 1)
    if (chosen.length === 0)
      return false
    schedule.data[chosen[0]!.p][chosen[0]!.d].AM = '舌苔评估'
  }

  // 2. Assign Personal Mandatory Tasks and Rest Days
  for (const p of STAFF) {
    let hasConsecutiveRest = false
    let relyOnMonday = false

    if (context.saturdayEmpty[p] && context.sundayEmpty[p]) {
      hasConsecutiveRest = true
    }
    else if (context.sundayEmpty[p] && isEmptyOrRest(schedule.data[p].Monday.AM) && isEmptyOrRest(schedule.data[p].Monday.PM)) {
      hasConsecutiveRest = true
      relyOnMonday = true
    }

    const restWindows: DayOfWeek[][] = []
    for (let i = 0; i < 6; i++) {
      const d1 = DAYS[i]!
      const d2 = DAYS[i + 1]!
      if (isEmptyOrRest(schedule.data[p][d1].AM) && isEmptyOrRest(schedule.data[p][d1].PM)
        && isEmptyOrRest(schedule.data[p][d2].AM) && isEmptyOrRest(schedule.data[p][d2].PM))
        restWindows.push([d1, d2])
    }

    if (!hasConsecutiveRest) {
      if (restWindows.length === 0)
        return false
      const chosenRest = getRandom(restWindows, 1)
      if (chosenRest.length === 0)
        return false
      ;(schedule as any)[`_rest_${p}`] = chosenRest[0]
    }
    else {
      ;(schedule as any)[`_rest_${p}`] = relyOnMonday ? ['Monday'] : []
    }

    // Assign 电话
    let hasDianhua = false
    for (const d of DAYS) {
      if (schedule.data[p][d].AM === '电话' || schedule.data[p][d].PM === '电话')
        hasDianhua = true
    }
    if (!hasDianhua) {
      const slots: { d: DayOfWeek, period: 'AM' | 'PM' }[] = []
      for (const d of DAYS) {
        if ((schedule as any)[`_rest_${p}`].includes(d))
          continue
        if (!isManual(p, d, 'AM') && schedule.data[p][d].AM === '')
          slots.push({ d, period: 'AM' })
        if (!isManual(p, d, 'PM') && schedule.data[p][d].PM === '')
          slots.push({ d, period: 'PM' })
      }
      if (slots.length === 0)
        return false
      const chosen = getRandom(slots, 1)
      if (chosen.length === 0)
        return false
      schedule.data[p][chosen[0]!.d][chosen[0]!.period] = '电话'
    }

    // Assign 筛查
    let hasShaicha = false
    for (const d of DAYS) {
      if (schedule.data[p][d].AM === '筛查' || schedule.data[p][d].PM === '筛查')
        hasShaicha = true
    }
    if (!hasShaicha) {
      const slots: { d: DayOfWeek, period: 'AM' | 'PM' }[] = []
      for (const d of DAYS) {
        if ((schedule as any)[`_rest_${p}`].includes(d))
          continue
        if (!isManual(p, d, 'AM') && schedule.data[p][d].AM === '')
          slots.push({ d, period: 'AM' })
        if (!isManual(p, d, 'PM') && schedule.data[p][d].PM === '')
          slots.push({ d, period: 'PM' })
      }
      if (slots.length === 0)
        return false
      const chosen = getRandom(slots, 1)
      if (chosen.length === 0)
        return false
      schedule.data[p][chosen[0]!.d][chosen[0]!.period] = '筛查'
    }
  }

  // 3. Fill remaining slots
  for (const p of STAFF) {
    const restDays: DayOfWeek[] = (schedule as any)[`_rest_${p}`] || []

    for (let i = 0; i < 7; i++) {
      const d = DAYS[i]!
      if (restDays.includes(d))
        continue

      // AM Slot
      if (!isManual(p, d, 'AM') && schedule.data[p][d].AM === '') {
        const prevDay = getPrevDay(d)
        const prevPM = prevDay ? schedule.data[p][prevDay].PM : context.sundayPM[p]
        if (prevPM === '随访下午/夜') {
          schedule.data[p][d].AM = ''
        }
        else {
          const prevAM = prevDay ? schedule.data[p][prevDay].AM : context.sundayAM[p]
          const nextDay = getNextDay(d)
          const nextAM: TaskName = nextDay ? schedule.data[p][nextDay].AM : ''

          if (!isAMFatigueTask(prevAM) && !isAMFatigueTask(nextAM))
            schedule.data[p][d].AM = Math.random() > 0.3 ? '随访上午' : ''
          else
            schedule.data[p][d].AM = ''
        }
      }

      // PM Slot
      if (!isManual(p, d, 'PM') && schedule.data[p][d].PM === '') {
        const rand = Math.random()
        if (rand > 0.6)
          schedule.data[p][d].PM = '随访下午/夜'
        else if (rand > 0.2)
          schedule.data[p][d].PM = '基础班'
        else
          schedule.data[p][d].PM = ''
      }
    }
  }

  return validateSchedule(schedule, context)
}

function validateSchedule(schedule: WeekSchedule, context: PrevWeekContext): boolean {
  // Check Dept rules
  let yundongCount = 0
  let shetaiCount = 0
  for (const p of STAFF) {
    for (const d of DAYS) {
      if (schedule.data[p][d].PM === '运动处方')
        yundongCount++
      if (schedule.data[p][d].AM === '舌苔评估')
        shetaiCount++
    }
  }
  if (yundongCount < 1 || shetaiCount < 1)
    return false

  // Check Fixed rules
  let thuPMCount = 0
  let satPMCount = 0
  for (const p of STAFF) {
    if (schedule.data[p].Thursday.PM === '群石墨修改')
      thuPMCount++
    if (schedule.data[p].Saturday.PM === '群石墨修改')
      satPMCount++
  }
  if (thuPMCount < 2 || satPMCount < 1)
    return false

  // Check Personal rules
  for (const p of STAFF) {
    let dianhuaCount = 0
    let shaichaCount = 0
    for (const d of DAYS) {
      if (schedule.data[p][d].AM === '电话' || schedule.data[p][d].PM === '电话')
        dianhuaCount++
      if (schedule.data[p][d].AM === '筛查' || schedule.data[p][d].PM === '筛查')
        shaichaCount++
    }
    if (dianhuaCount < 1 || shaichaCount < 1)
      return false

    // Check 2 consecutive rest days
    let hasConsecutiveRest = false
    if (context.saturdayEmpty[p] && context.sundayEmpty[p])
      hasConsecutiveRest = true
    if (context.sundayEmpty[p] && isEmptyOrRest(schedule.data[p].Monday.AM) && isEmptyOrRest(schedule.data[p].Monday.PM))
      hasConsecutiveRest = true
    for (let i = 0; i < 6; i++) {
      const d1 = DAYS[i]!
      const d2 = DAYS[i + 1]!
      if (isEmptyOrRest(schedule.data[p][d1].AM) && isEmptyOrRest(schedule.data[p][d1].PM)
        && isEmptyOrRest(schedule.data[p][d2].AM) && isEmptyOrRest(schedule.data[p][d2].PM))
        hasConsecutiveRest = true
    }
    if (!hasConsecutiveRest)
      return false

    // Check Night shift fatigue
    if (context.sundayPM[p] === '随访下午/夜' && schedule.data[p].Monday.AM !== '')
      return false
    for (let i = 0; i < 6; i++) {
      const d = DAYS[i]!
      const nextD = DAYS[i + 1]!
      if (schedule.data[p][d].PM === '随访下午/夜' && schedule.data[p][nextD].AM !== '')
        return false
    }

    // Check AM fatigue
    if (isAMFatigueTask(context.sundayAM[p]) && isAMFatigueTask(schedule.data[p].Monday.AM))
      return false
    for (let i = 0; i < 6; i++) {
      const d = DAYS[i]!
      const nextD = DAYS[i + 1]!
      if (isAMFatigueTask(schedule.data[p][d].AM) && isAMFatigueTask(schedule.data[p][nextD].AM))
        return false
    }
  }

  return true
}
