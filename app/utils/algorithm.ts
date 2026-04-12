import type { DayOfWeek, StaffName, TaskName, WeekSchedule } from '~/types/schedule'
import { format, parseISO, subWeeks } from 'date-fns'
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

function isAMFatigueTask(task: TaskName): boolean {
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
  // 1. Determine Rest Days for each person
  for (const p of STAFF) {
    const validRestPatterns: DayOfWeek[][] = []

    const patterns: DayOfWeek[][] = [
      ['Monday', 'Tuesday'],
      ['Tuesday', 'Wednesday'],
      ['Wednesday', 'Thursday'],
      ['Thursday', 'Friday'],
      ['Friday', 'Saturday'],
      ['Saturday', 'Sunday'],
      ['Sunday'], // 跨周下周一休假
    ]
    if (context.sundayEmpty[p]) {
      patterns.push(['Monday']) // 跨周连休上周日+本周一
    }

    for (const pat of patterns) {
      let valid = true
      for (const d of DAYS) {
        const isRestDay = pat.includes(d)
        const am = schedule.data[p][d].AM
        const pm = schedule.data[p][d].PM
        const manualAM = isManual(p, d, 'AM')
        const manualPM = isManual(p, d, 'PM')

        if (isRestDay) {
          // 休息天必须为空或手动指定了休假，绝不能是其他任务
          if ((manualAM && am !== '休假') || (manualPM && pm !== '休假')) {
            valid = false
            break
          }
        }
        else {
          // 非休息天如果手动设置了休假，也会冲突
          if ((manualAM && am === '休假') || (manualPM && pm === '休假')) {
            valid = false
            break
          }
        }
      }
      if (valid)
        validRestPatterns.push(pat)
    }

    if (validRestPatterns.length === 0)
      return false
    const chosenRest = getRandom(validRestPatterns, 1)[0]!
    ;(schedule as any)[`_rest_${p}`] = chosenRest

    // Apply rest days
    for (const d of chosenRest) {
      if (!isManual(p, d, 'AM'))
        schedule.data[p][d].AM = '休假'
      if (!isManual(p, d, 'PM'))
        schedule.data[p][d].PM = '休假'
    }
  }

  const getAvailableSlots = (taskMatcher: (p: StaffName, d: DayOfWeek, period: 'AM' | 'PM') => boolean) => {
    const slots: { p: StaffName, d: DayOfWeek, period: 'AM' | 'PM' }[] = []
    for (const p of STAFF) {
      const restDays = (schedule as any)[`_rest_${p}`] as DayOfWeek[]
      for (const d of DAYS) {
        if (restDays.includes(d))
          continue
        if (!isManual(p, d, 'AM') && schedule.data[p][d].AM === '' && taskMatcher(p, d, 'AM')) {
          slots.push({ p, d, period: 'AM' })
        }
        if (!isManual(p, d, 'PM') && schedule.data[p][d].PM === '' && taskMatcher(p, d, 'PM')) {
          slots.push({ p, d, period: 'PM' })
        }
      }
    }
    return slots
  }

  // 2. Assign Fixed Tasks
  const thuPMCount = STAFF.filter(p => schedule.data[p].Thursday.PM === '群石墨修改').length
  if (thuPMCount < 2) {
    const cands = STAFF.filter(p => !((schedule as any)[`_rest_${p}`].includes('Thursday')) && !isManual(p, 'Thursday', 'PM') && schedule.data[p].Thursday.PM === '')
    if (cands.length < 2 - thuPMCount)
      return false
    for (const p of getRandom(cands, 2 - thuPMCount)) schedule.data[p].Thursday.PM = '群石墨修改'
  }

  const satPMCount = STAFF.filter(p => schedule.data[p].Saturday.PM === '群石墨修改').length
  if (satPMCount < 1) {
    const cands = STAFF.filter(p => !((schedule as any)[`_rest_${p}`].includes('Saturday')) && !isManual(p, 'Saturday', 'PM') && schedule.data[p].Saturday.PM === '')
    if (cands.length < 1 - satPMCount)
      return false
    for (const p of getRandom(cands, 1 - satPMCount)) schedule.data[p].Saturday.PM = '群石墨修改'
  }

  // 3. Assign Dept Tasks
  let hasYundong = false
  for (const p of STAFF) {
    for (const d of DAYS) {
      if (schedule.data[p][d].PM === '运动处方')
        hasYundong = true
    }
  }
  if (!hasYundong) {
    const pmSlots = getAvailableSlots((_p, _d, period) => period === 'PM')
    if (pmSlots.length === 0)
      return false
    const chosen = getRandom(pmSlots, 1)[0]!
    schedule.data[chosen.p][chosen.d].PM = '运动处方'
  }

  let hasShetai = false
  for (const p of STAFF) {
    for (const d of DAYS) {
      if (schedule.data[p][d].AM === '舌苔评估')
        hasShetai = true
    }
  }
  if (!hasShetai) {
    const amSlots = getAvailableSlots((p, d, period) => {
      if (period !== 'AM')
        return false
      const prevDay = getPrevDay(d)
      const nextDay = getNextDay(d)
      const prevAM = prevDay ? schedule.data[p][prevDay].AM : context.sundayAM[p]
      const nextAM = nextDay ? schedule.data[p][nextDay].AM : '' as TaskName
      return !isAMFatigueTask(prevAM) && !isAMFatigueTask(nextAM)
    })
    if (amSlots.length === 0)
      return false
    const chosen = getRandom(amSlots, 1)[0]!
    schedule.data[chosen.p][chosen.d].AM = '舌苔评估'
  }

  // 4. Assign Personal Mandatory Tasks
  for (const p of STAFF) {
    let hasDianhua = false
    for (const d of DAYS) {
      if (schedule.data[p][d].AM === '电话' || schedule.data[p][d].PM === '电话')
        hasDianhua = true
    }
    if (!hasDianhua) {
      const slots = getAvailableSlots((_p, _d, _period) => _p === p)
      if (slots.length === 0)
        return false
      const chosen = getRandom(slots, 1)[0]!
      schedule.data[p][chosen.d][chosen.period] = '电话'
    }

    let hasShaicha = false
    for (const d of DAYS) {
      if (schedule.data[p][d].AM === '筛查' || schedule.data[p][d].PM === '筛查')
        hasShaicha = true
    }
    if (!hasShaicha) {
      const slots = getAvailableSlots((_p, _d, _period) => _p === p)
      if (slots.length === 0)
        return false
      const chosen = getRandom(slots, 1)[0]!
      schedule.data[p][chosen.d][chosen.period] = '筛查'
    }
  }

  // 5. Fill remaining slots
  for (const p of STAFF) {
    const restDays = (schedule as any)[`_rest_${p}`] as DayOfWeek[]

    for (let i = 0; i < 7; i++) {
      const d = DAYS[i]!
      if (restDays.includes(d))
        continue

      // For AM
      if (!isManual(p, d, 'AM') && schedule.data[p][d].AM === '') {
        const prevDay = getPrevDay(d)
        const prevPM = prevDay ? schedule.data[p][prevDay].PM : context.sundayPM[p]

        if (prevPM === '随访下午/夜') {
          schedule.data[p][d].AM = ''
        }
        else {
          const prevAM = prevDay ? schedule.data[p][prevDay].AM : context.sundayAM[p]
          const nextDay = getNextDay(d)
          const nextAM = nextDay ? schedule.data[p][nextDay].AM : '' as TaskName

          if (!isAMFatigueTask(prevAM) && !isAMFatigueTask(nextAM)) {
            schedule.data[p][d].AM = Math.random() > 0.4 ? '随访上午' : ''
          }
          else {
            schedule.data[p][d].AM = ''
          }
        }
      }

      // For PM
      if (!isManual(p, d, 'PM') && schedule.data[p][d].PM === '') {
        const nextDay = getNextDay(d)
        const nextAM = nextDay ? schedule.data[p][nextDay].AM : '' as TaskName
        const canHaveNightShift = nextAM === '' || nextAM === '休假'

        const rand = Math.random()
        if (canHaveNightShift && rand > 0.6)
          schedule.data[p][d].PM = '随访下午/夜'
        else if (rand > 0.2)
          schedule.data[p][d].PM = '基础班'
        else
          schedule.data[p][d].PM = ''
      }

      // 强制非连休天绝不可纯空
      if (!isManual(p, d, 'PM') && schedule.data[p][d].AM === '' && schedule.data[p][d].PM === '') {
        schedule.data[p][d].PM = Math.random() > 0.5 ? '随访下午/夜' : '基础班'
      }
    }
  }

  return validateSchedule(schedule, context, isManual)
}

function validateSchedule(
  schedule: WeekSchedule,
  context: PrevWeekContext,
  isManual: (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM') => boolean,
): boolean {
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

    let emptyDays = 0
    const emptyDayList: DayOfWeek[] = []
    for (const d of DAYS) {
      const am = schedule.data[p][d].AM
      const pm = schedule.data[p][d].PM
      const isRest = (am === '休假' && pm === '休假') || (am === '' && pm === '')

      if ((am === '休假') !== (pm === '休假'))
        return false

      if (isRest) {
        emptyDays++
        emptyDayList.push(d)
      }
    }

    if (emptyDays === 1) {
      const d = emptyDayList[0]!
      if (d === 'Monday' && context.sundayEmpty[p]) {
        // Valid
      }
      else if (d === 'Sunday') {
        // Valid
      }
      else {
        return false
      }
    }
    else if (emptyDays === 2) {
      const d1 = DAYS.indexOf(emptyDayList[0]!)
      const d2 = DAYS.indexOf(emptyDayList[1]!)
      if (d2 - d1 !== 1)
        return false
    }
    else {
      return false
    }

    // Night shift fatigue (Allow bypass if completely forced by manual inputs)
    if (context.sundayPM[p] === '随访下午/夜' && schedule.data[p].Monday.AM !== '' && schedule.data[p].Monday.AM !== '休假') {
      if (!isManual(p, 'Monday', 'AM'))
        return false
    }
    for (let i = 0; i < 6; i++) {
      const d = DAYS[i]!
      const nextD = DAYS[i + 1]!
      if (schedule.data[p][d].PM === '随访下午/夜' && schedule.data[p][nextD].AM !== '' && schedule.data[p][nextD].AM !== '休假') {
        if (!isManual(p, d, 'PM') || !isManual(p, nextD, 'AM'))
          return false
      }
    }

    // AM fatigue (Allow bypass if completely forced by manual inputs)
    if (isAMFatigueTask(context.sundayAM[p]) && isAMFatigueTask(schedule.data[p].Monday.AM)) {
      if (!isManual(p, 'Monday', 'AM'))
        return false
    }
    for (let i = 0; i < 6; i++) {
      const d = DAYS[i]!
      const nextD = DAYS[i + 1]!
      if (isAMFatigueTask(schedule.data[p][d].AM) && isAMFatigueTask(schedule.data[p][nextD].AM)) {
        if (!isManual(p, d, 'AM') || !isManual(p, nextD, 'AM'))
          return false
      }
    }
  }

  return true
}
