import type { DayOfWeek, StaffName, TaskName, WeekSchedule } from '~/types/schedule'
import { format, parseISO, subWeeks } from 'date-fns'
import { DAYS, STAFF, TASKS } from '~/types/schedule'
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
export interface ScheduleGroup {
  diff: number
  schedules: WeekSchedule[]
}

export function generateSchedule(currentSchedule: WeekSchedule, activeRules: string[]): ScheduleGroup[] | null {
  const context = getPrevWeekContext(currentSchedule.weekStartDate)

  const isManual = (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM'): boolean => {
    return currentSchedule.data[person][day][period] !== ''
  }

  const restDaysConfig = currentSchedule.restDays || { 组长: 2, 成员A: 2, 成员B: 2, 成员C: 2 }
  const MAX_ATTEMPTS = 2000

  const diffMap = new Map<number, Set<string>>()

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const newSchedule: WeekSchedule = JSON.parse(JSON.stringify(currentSchedule))
    if (tryGenerate(newSchedule, context, isManual, activeRules, restDaysConfig)) {
      for (const p of STAFF) {
        delete (newSchedule as any)[`_rest_${p}`]
      }

      let maxW = 0
      let minW = Infinity
      for (const p of STAFF) {
        if (p === '组长')
          continue // 组长不参与工作量差值的考核

        let w = 0
        for (const d of DAYS) {
          const am = newSchedule.data[p][d].AM
          const pm = newSchedule.data[p][d].PM
          if (am && TASKS[am])
            w += TASKS[am].weight
          if (pm && TASKS[pm])
            w += TASKS[pm].weight
        }
        maxW = Math.max(maxW, w)
        minW = Math.min(minW, w)
      }
      const diff = Number((maxW - minW).toFixed(1))

      // 成员间差值最大允许为 1.0，将所有合法的组合按差值分组记录并去重
      if (diff <= 1.0) {
        if (!diffMap.has(diff)) {
          diffMap.set(diff, new Set<string>())
        }
        diffMap.get(diff)!.add(JSON.stringify(newSchedule))
      }
    }
  }

  if (diffMap.size > 0) {
    const result: ScheduleGroup[] = []
    const sortedDiffs = Array.from(diffMap.keys()).sort((a, b) => a - b)

    for (const diff of sortedDiffs) {
      const uniqueArr = Array.from(diffMap.get(diff)!)
      result.push({
        diff,
        schedules: uniqueArr.map(str => JSON.parse(str)),
      })
    }
    return result
  }

  return null
}

function getRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, n)
}

function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 0)
    return [[]]
  if (k === arr.length)
    return [arr]
  if (k > arr.length)
    return []
  const res: T[][] = []
  function dfs(start: number, current: T[]) {
    if (current.length === k) {
      res.push([...current])
      return
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i])
      dfs(i + 1, current)
      current.pop()
    }
  }
  dfs(0, [])
  return res
}

function tryGenerate(
  schedule: WeekSchedule,
  context: PrevWeekContext,
  isManual: (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM') => boolean,
  activeRules: string[],
  restDaysConfig: Record<StaffName, number>,
): boolean {
  const hasRule = (rule: string) => activeRules.includes(rule)

  // 1. Determine Rest Days
  const restCounts: Record<DayOfWeek, number> = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 }

  for (const p of STAFF) {
    const validRestPatterns: DayOfWeek[][] = []
    const k = restDaysConfig[p]
    let patterns: DayOfWeek[][] = []

    if (k === 2 && hasRule('consecutive_rest')) {
      patterns = [
        ['Monday', 'Tuesday'],
        ['Tuesday', 'Wednesday'],
        ['Wednesday', 'Thursday'],
        ['Thursday', 'Friday'],
        ['Friday', 'Saturday'],
        ['Saturday', 'Sunday'],
        ['Monday', 'Sunday'], // 跨周连休两头
      ]
    }
    else {
      patterns = getCombinations(DAYS, k)
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
          if ((manualAM && am !== '休假' && am !== '') || (manualPM && pm !== '休假' && pm !== ''))
            valid = false
        }
        else {
          if ((manualAM && am === '休假') || (manualPM && pm === '休假'))
            valid = false
        }
      }
      if (valid)
        validRestPatterns.push(pat)
    }

    if (validRestPatterns.length === 0)
      return false
    const chosenRest = getRandom(validRestPatterns, 1)[0]!
    ;(schedule as any)[`_rest_${p}`] = chosenRest

    for (const d of chosenRest) {
      restCounts[d]++
      if (!isManual(p, d, 'AM'))
        schedule.data[p][d].AM = '休假'
      if (!isManual(p, d, 'PM'))
        schedule.data[p][d].PM = '休假'
    }
  }

  if (hasRule('daily_basic')) {
    for (const d of DAYS) {
      if (restCounts[d] > 2)
        return false
    }
  }
  if (hasRule('fixed_tasks')) {
    if (restCounts.Thursday > 0)
      return false
    if (restCounts.Saturday > 1)
      return false
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

  // 2. Fixed Tasks
  if (hasRule('fixed_tasks')) {
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
  }

  // 3. Dept Tasks
  if (hasRule('dept_mandatory')) {
    let hasYundong = false
    for (const p of STAFF) {
      if (DAYS.some(d => schedule.data[p][d].PM === '运动处方'))
        hasYundong = true
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
      if (DAYS.some(d => schedule.data[p][d].AM === '舌苔评估'))
        hasShetai = true
    }
    if (!hasShetai) {
      const amSlots = getAvailableSlots((p, d, period) => {
        if (period !== 'AM')
          return false
        const prevDay = getPrevDay(d)
        const nextDay = getNextDay(d)
        const prevPM = prevDay ? schedule.data[p][prevDay].PM : context.sundayPM[p]
        const prevAM = prevDay ? schedule.data[p][prevDay].AM : context.sundayAM[p]
        const nextAM = nextDay ? schedule.data[p][nextDay].AM : '' as TaskName

        if (hasRule('night_fatigue') && prevPM === '随访下午/夜')
          return false
        if (hasRule('am_fatigue') && (isAMFatigueTask(prevAM) || isAMFatigueTask(nextAM)))
          return false
        return true
      })
      if (amSlots.length === 0)
        return false
      const chosen = getRandom(amSlots, 1)[0]!
      schedule.data[chosen.p][chosen.d].AM = '舌苔评估'
    }
  }

  // 4. Daily Basic
  if (hasRule('daily_basic')) {
    for (const d of DAYS) {
      const assignDaily = (task: TaskName, period: 'AM' | 'PM') => {
        if (STAFF.some(p => schedule.data[p][d][period] === task))
          return true
        const cands = STAFF.filter((p) => {
          if (((schedule as any)[`_rest_${p}`] as DayOfWeek[]).includes(d))
            return false
          if (isManual(p, d, period))
            return false
          if (schedule.data[p][d][period] !== '')
            return false

          if (period === 'AM') {
            const prevDay = getPrevDay(d)
            const prevPM = prevDay ? schedule.data[p][prevDay].PM : context.sundayPM[p]
            const prevAM = prevDay ? schedule.data[p][prevDay].AM : context.sundayAM[p]
            if (hasRule('night_fatigue') && prevPM === '随访下午/夜')
              return false
            if (hasRule('am_fatigue') && isAMFatigueTask(prevAM) && isAMFatigueTask(task))
              return false
          }
          return true
        })
        if (cands.length === 0)
          return false
        schedule.data[getRandom(cands, 1)[0]!][d][period] = task
        return true
      }

      if (!assignDaily('随访上午', 'AM'))
        return false
      if (!assignDaily('随访下午/夜', 'PM'))
        return false
      if (!assignDaily('基础班', 'PM'))
        return false
    }
  }

  // 5. Personal Mandatory
  if (hasRule('personal_mandatory')) {
    for (const p of STAFF) {
      const assignPersonal = (task: TaskName) => {
        if (DAYS.some(d => schedule.data[p][d].AM === task || schedule.data[p][d].PM === task))
          return true
        let slots = getAvailableSlots((_p, d, _period) => _p === p && schedule.data[p][d].AM === '' && schedule.data[p][d].PM === '')
        if (slots.length === 0)
          slots = getAvailableSlots((_p, d, _period) => _p === p)
        if (slots.length === 0)
          return false
        const chosen = getRandom(slots, 1)[0]!
        schedule.data[chosen.p][chosen.d][chosen.period] = task
        return true
      }
      if (!assignPersonal('电话'))
        return false
      if (!assignPersonal('筛查'))
        return false
    }
  }

  // 留白处理：不再使用随机任务强制填补空位，所有剩余槽位保留为 ''（即"未设置"），用于预留门诊。
  return validateSchedule(schedule, context, isManual, activeRules, restDaysConfig)
}

function validateSchedule(
  schedule: WeekSchedule,
  context: PrevWeekContext,
  isManual: (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM') => boolean,
  activeRules: string[],
  restDaysConfig: Record<StaffName, number>,
): boolean {
  const hasRule = (rule: string) => activeRules.includes(rule)

  if (hasRule('daily_basic')) {
    for (const d of DAYS) {
      let sfam = 0; let sfpm = 0; let jc = 0
      for (const p of STAFF) {
        if (schedule.data[p][d].AM === '随访上午')
          sfam++
        if (schedule.data[p][d].PM === '随访下午/夜')
          sfpm++
        if (schedule.data[p][d].PM === '基础班')
          jc++
      }
      if (sfam !== 1 || sfpm !== 1 || jc !== 1)
        return false
    }
  }

  if (hasRule('dept_mandatory')) {
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
  }

  if (hasRule('fixed_tasks')) {
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
  }

  for (const p of STAFF) {
    if (hasRule('personal_mandatory')) {
      let dianhuaCount = 0
      let shaichaCount = 0
      for (const d of DAYS) {
        if (schedule.data[p][d].AM === '电话' || schedule.data[p][d].PM === '电话')
          dianhuaCount++
        if (schedule.data[p][d].AM === '筛查' || schedule.data[p][d].PM === '筛查')
          shaichaCount++
      }
      // 要求绝对等于1
      if (dianhuaCount !== 1 || shaichaCount !== 1)
        return false
    }

    let emptyDays = 0
    const emptyDayList: DayOfWeek[] = []
    for (const d of DAYS) {
      const am = schedule.data[p][d].AM
      const pm = schedule.data[p][d].PM

      // 绝不可出现半天休假的情况（除非手动安排，否则算法生成禁止）
      if ((am === '休假') !== (pm === '休假'))
        return false

      if (am === '休假' && pm === '休假') {
        emptyDays++
        emptyDayList.push(d)
      }
    }

    const expectedRestDays = restDaysConfig[p]
    if (emptyDays !== expectedRestDays)
      return false

    if (expectedRestDays === 2 && hasRule('consecutive_rest')) {
      const d1 = emptyDayList[0]!
      const d2 = emptyDayList[1]!
      const isConsecutive = DAYS.indexOf(d2) - DAYS.indexOf(d1) === 1
      const isEnds = d1 === 'Monday' && d2 === 'Sunday'
      if (!isConsecutive && !isEnds)
        return false
    }

    if (hasRule('night_fatigue')) {
      if (context.sundayPM[p] === '随访下午/夜' && isAMFatigueTask(schedule.data[p].Monday.AM)) {
        if (!isManual(p, 'Monday', 'AM'))
          return false
      }
      for (let i = 0; i < 6; i++) {
        const d = DAYS[i]!
        const nextD = DAYS[i + 1]!
        if (schedule.data[p][d].PM === '随访下午/夜' && isAMFatigueTask(schedule.data[p][nextD].AM)) {
          if (!isManual(p, d, 'PM') || !isManual(p, nextD, 'AM'))
            return false
        }
      }
    }

    if (hasRule('am_fatigue')) {
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
  }

  return true
}
