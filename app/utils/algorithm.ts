import type { DayOfWeek, StaffName, TaskInfo, TaskName, WeekSchedule } from '~/types/schedule'
import { format, parseISO, subWeeks } from 'date-fns'
import { DAY_LABELS, DAYS, STAFF } from '~/types/schedule'
import { loadSchedule } from './schedule'

export const isEmptyOrRest = (task: TaskName): boolean => task === '' || task === '休假' || task === '休息'

export interface PrevWeekContext {
  sundayAM: Record<StaffName, TaskName>
  sundayPM: Record<StaffName, TaskName>
  sundayNIGHT: Record<StaffName, TaskName>
  saturdayEmpty: Record<StaffName, boolean>
  sundayEmpty: Record<StaffName, boolean>
}

export function getPrevWeekContext(weekStartDate: string): PrevWeekContext {
  const prevWeekDate = format(subWeeks(parseISO(weekStartDate), 1), 'yyyy-MM-dd')
  const prevSchedule = loadSchedule(prevWeekDate)

  const context = {
    sundayAM: {} as Record<StaffName, TaskName>,
    sundayPM: {} as Record<StaffName, TaskName>,
    sundayNIGHT: {} as Record<StaffName, TaskName>,
    saturdayEmpty: {} as Record<StaffName, boolean>,
    sundayEmpty: {} as Record<StaffName, boolean>,
  }

  for (const person of STAFF) {
    const sat = prevSchedule.data[person].Saturday
    const sun = prevSchedule.data[person].Sunday

    context.sundayAM[person] = sun.AM
    context.sundayPM[person] = sun.PM
    context.sundayNIGHT[person] = sun.NIGHT
    context.saturdayEmpty[person] = isEmptyOrRest(sat.AM) && isEmptyOrRest(sat.PM) && isEmptyOrRest(sat.NIGHT)
    context.sundayEmpty[person] = isEmptyOrRest(sun.AM) && isEmptyOrRest(sun.PM) && isEmptyOrRest(sun.NIGHT)
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

/**
 * 生成排班方案的特征签名，用于排除成员A/B/C互换导致的重复
 */
function getScheduleSignature(schedule: WeekSchedule): string {
  // 组长是固定的，直接转化
  const leaderData = JSON.stringify(schedule.data['组长'])

  // 成员A, B, C 是等价的，将他们的排班数据存入数组并进行排序
  const memberSchedules = [
    JSON.stringify(schedule.data['成员A']),
    JSON.stringify(schedule.data['成员B']),
    JSON.stringify(schedule.data['成员C']),
  ].sort() // 字母排序保证了 A/B/C 互换位置后签名一致

  return `${leaderData}|${memberSchedules.join('||')}`
}

// 优化后单次搜索效率极高，60万次即可覆盖极大量优质、本质不同的均衡方案
const MAX_ATTEMPTS = 600000
const PROGRESS_INTERVAL = Math.max(1, Math.floor(MAX_ATTEMPTS / 100))

// 提速补丁：取代极慢的 JSON.parse(JSON.stringify)
function fastCloneSchedule(base: WeekSchedule): WeekSchedule {
  const newData = {} as Record<StaffName, any>
  for (const p of STAFF) {
    newData[p] = {}
    for (const d of DAYS) {
      newData[p][d] = { AM: base.data[p][d].AM, PM: base.data[p][d].PM, NIGHT: base.data[p][d].NIGHT }
    }
  }
  return {
    weekStartDate: base.weekStartDate,
    restDays: base.restDays ? { ...base.restDays } : undefined,
    data: newData as any,
  }
}

export function generateScheduleCore(
  currentSchedule: WeekSchedule,
  activeRules: string[],
  context: PrevWeekContext,
  taskConfigs: Record<TaskName, TaskInfo>,
  onProgress?: (progress: number) => void,
): ScheduleGroup[] | null {
  const isManual = (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT'): boolean => {
    return currentSchedule.data[person][day][period] !== ''
  }

  const restDaysConfig = currentSchedule.restDays || { 组长: 1, 成员A: 2, 成员B: 2, 成员C: 2 }

  const diffGroups = new Map<number, Map<string, WeekSchedule>>()

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const newSchedule: WeekSchedule = fastCloneSchedule(currentSchedule)

    if (tryGenerate(newSchedule, context, isManual, activeRules, restDaysConfig, taskConfigs)) {
      // 清理临时数据，并将所有未设置（空值）转换为"休息"
      for (const p of STAFF) {
        delete (newSchedule as any)[`_rest_${p}`]
        for (const d of DAYS) {
          if (newSchedule.data[p][d].AM === '')
            newSchedule.data[p][d].AM = '休息'
          if (newSchedule.data[p][d].PM === '')
            newSchedule.data[p][d].PM = '休息'
          if (newSchedule.data[p][d].NIGHT === '')
            newSchedule.data[p][d].NIGHT = '休息'
        }
      }

      // 计算工作量差值（仅限成员）
      const memberWorkloads: number[] = []
      for (const p of STAFF) {
        if (p === '组长')
          continue
        let w = 0
        for (const d of DAYS) {
          const am = newSchedule.data[p][d].AM
          const pm = newSchedule.data[p][d].PM
          const night = newSchedule.data[p][d].NIGHT
          if (am && taskConfigs[am])
            w += taskConfigs[am].weight
          if (pm && taskConfigs[pm])
            w += taskConfigs[pm].weight
          if (night && taskConfigs[night])
            w += taskConfigs[night].weight
        }
        memberWorkloads.push(w)
      }
      const diff = Number((Math.max(...memberWorkloads) - Math.min(...memberWorkloads)).toFixed(1))

      // 生成方案的唯一特征签名（排除ABC互换干扰）
      const signature = getScheduleSignature(newSchedule)

      if (!diffGroups.has(diff)) {
        diffGroups.set(diff, new Map())
      }

      // 如果该差值下还没有这个”本质不同”的方案，则记录
      if (!diffGroups.get(diff)!.has(signature)) {
        diffGroups.get(diff)!.set(signature, newSchedule)
      }
    }

    if (onProgress && attempt % PROGRESS_INTERVAL === 0) {
      onProgress((attempt / MAX_ATTEMPTS) * 100)
    }
  }

  if (onProgress)
    onProgress(100)

  if (diffGroups.size > 0) {
    const result: ScheduleGroup[] = []
    const sortedDiffs = Array.from(diffGroups.keys()).sort((a, b) => a - b)

    for (const diff of sortedDiffs) {
      const schedules = Array.from(diffGroups.get(diff)!.values())
      result.push({
        diff,
        schedules,
      })
    }
    return result
  }

  return null
}

export function generateSchedule(currentSchedule: WeekSchedule, activeRules: string[], taskConfigs: Record<TaskName, TaskInfo>): ScheduleGroup[] | null {
  const context = getPrevWeekContext(currentSchedule.weekStartDate)
  return generateScheduleCore(currentSchedule, activeRules, context, taskConfigs)
}

// 辅助方法：获取任务配置的指定时段
function getTaskPeriod(taskConfigs: Record<TaskName, TaskInfo>, task: TaskName, fallback: 'AM' | 'PM' | 'NIGHT'): 'AM' | 'PM' | 'NIGHT' {
  const p = taskConfigs[task]?.period
  return p === 'ANY' ? fallback : (p as 'AM' | 'PM' | 'NIGHT')
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
      current.push(arr[i]!)
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
  isManual: (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT') => boolean,
  activeRules: string[],
  restDaysConfig: Record<StaffName, number>,
  taskConfigs: Record<TaskName, TaskInfo>,
): boolean {
  const hasRule = (rule: string) => activeRules.includes(rule)

  // --- 0. 引入启发式工作量追踪，保证每次随机优先派给工作量少的人 ---
  const currentWorkload = { 组长: 0, 成员A: 0, 成员B: 0, 成员C: 0 }
  for (const p of STAFF) {
    for (const d of DAYS) {
      const am = schedule.data[p][d].AM; if (am && taskConfigs[am])
        currentWorkload[p] += taskConfigs[am].weight
      const pm = schedule.data[p][d].PM; if (pm && taskConfigs[pm])
        currentWorkload[p] += taskConfigs[pm].weight
      const night = schedule.data[p][d].NIGHT; if (night && taskConfigs[night])
        currentWorkload[p] += taskConfigs[night].weight
    }
  }

  // 核心优化：贪心随机选取策略。在可用候选中，偏向挑选当前工作量最低的，自然收敛于低差值
  const pickPerson = (cands: StaffName[], taskWeight: number) => {
    if (cands.length === 0)
      return null
    cands.sort((a, b) => currentWorkload[a] - currentWorkload[b])
    // 从工作量最少的前半部分人中随机抽，兼顾了随机性和均衡性 (ABC等价性在这里被动态拉平)
    const pool = cands.slice(0, Math.max(1, Math.ceil(cands.length / 2)))
    const chosen = pool[Math.floor(Math.random() * pool.length)]!
    currentWorkload[chosen] += taskWeight
    return chosen
  }

  const pickSlot = (slots: { p: StaffName, d: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT' }[], taskWeight: number) => {
    if (slots.length === 0)
      return null
    slots.sort((a, b) => currentWorkload[a.p] - currentWorkload[b.p])
    const pool = slots.slice(0, Math.max(1, Math.ceil(slots.length / 2)))
    const chosen = pool[Math.floor(Math.random() * pool.length)]!
    currentWorkload[chosen.p] += taskWeight
    return chosen
  }

  // --- 1. 分配休息日 ---
  const restCounts: Record<DayOfWeek, number> = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 }

  for (const p of STAFF) {
    const validRestPatterns: DayOfWeek[][] = []
    const k = restDaysConfig[p] || 2
    let patterns: DayOfWeek[][] = []

    if (k === 2 && hasRule('consecutive_rest')) {
      patterns = [
        ['Monday', 'Tuesday'],
        ['Tuesday', 'Wednesday'],
        ['Wednesday', 'Thursday'],
        ['Thursday', 'Friday'],
        ['Friday', 'Saturday'],
        ['Saturday', 'Sunday'],
        ['Monday', 'Sunday'], // 跨周连休
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
        const night = schedule.data[p][d].NIGHT
        const manualAM = isManual(p, d, 'AM')
        const manualPM = isManual(p, d, 'PM')
        const manualNIGHT = isManual(p, d, 'NIGHT')

        if (isRestDay) {
          if ((manualAM && am !== '休假' && am !== '')
            || (manualPM && pm !== '休假' && pm !== '')
            || (manualNIGHT && night !== '休假' && night !== '')) {
            valid = false
          }
        }
        else {
          if ((manualAM && am === '休假') || (manualPM && pm === '休假') || (manualNIGHT && night === '休假'))
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
      if (!isManual(p, d, 'NIGHT'))
        schedule.data[p][d].NIGHT = '休假'
    }
  }

  // --- 2. 提前剪枝 (Early Pruning) ---
  // 计算每天剩余可排班人手，若遭遇必然失败的瓶颈直接舍弃，节省巨量时间
  const availAM: Record<DayOfWeek, number> = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 }
  const availPM: Record<DayOfWeek, number> = { ...availAM }
  const availNIGHT: Record<DayOfWeek, number> = { ...availAM }

  for (const d of DAYS) {
    for (const p of STAFF) {
      const isRest = ((schedule as any)[`_rest_${p}`] as DayOfWeek[]).includes(d)
      if (!isRest) {
        if (!isManual(p, d, 'AM') || schedule.data[p][d].AM === '')
          availAM[d]++
        if (!isManual(p, d, 'PM') || schedule.data[p][d].PM === '')
          availPM[d]++
        if (!isManual(p, d, 'NIGHT') || schedule.data[p][d].NIGHT === '')
          availNIGHT[d]++
      }
    }
  }

  // 根据开启的规则，通过动态读取任务的时段配置，计算每天各个时段最低需要的总硬性槽位
  for (const d of DAYS) {
    let reqAM = 0; let reqPM = 0; let reqNIGHT = 0
    const addReq = (task: TaskName, count: number) => {
      const p = taskConfigs[task].period
      if (p === 'AM')
        reqAM += count
      if (p === 'PM')
        reqPM += count
      if (p === 'NIGHT')
        reqNIGHT += count
    }
    if (hasRule('daily_basic')) {
      addReq('随访上午', 1); addReq('随访下午', 1); addReq('随访夜', 1)
      if (d !== 'Saturday')
        addReq('基础班', 1)
    }
    if (hasRule('fixed_tasks')) {
      if (d === 'Thursday')
        addReq('群石墨修改', 2)
      if (d === 'Saturday')
        addReq('群石墨修改', 1)
    }
    // 叠加后判断，若当天可用人手低于各规则叠加后的硬性要求，直接极速剪枝
    if (availAM[d] < reqAM || availPM[d] < reqPM || availNIGHT[d] < reqNIGHT) {
      return false
    }
    // 特殊：周六基础班可排在上午或下午，因此周六的AM+PM总量需足够承载额外1个基础班
    if (hasRule('daily_basic') && d === 'Saturday') {
      if (availAM[d] + availPM[d] < reqAM + reqPM + 1)
        return false
    }
  }

  const getAvailableSlots = (taskMatcher: (p: StaffName, d: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT') => boolean) => {
    const slots: { p: StaffName, d: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT' }[] = []
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
        if (!isManual(p, d, 'NIGHT') && schedule.data[p][d].NIGHT === '' && taskMatcher(p, d, 'NIGHT')) {
          slots.push({ p, d, period: 'NIGHT' })
        }
      }
    }
    return slots
  }

  // --- 3. 安排固定任务 (最高限制) ---
  if (hasRule('fixed_tasks')) {
    const fixedPeriod = getTaskPeriod(taskConfigs, '群石墨修改', 'PM')
    const thuPMCount = STAFF.filter(p => schedule.data[p].Thursday[fixedPeriod] === '群石墨修改').length
    if (thuPMCount < 2) {
      const cands = STAFF.filter(p => !((schedule as any)[`_rest_${p}`].includes('Thursday')) && !isManual(p, 'Thursday', fixedPeriod) && schedule.data[p].Thursday[fixedPeriod] === '')
      if (cands.length < 2 - thuPMCount)
        return false
      for (let i = 0; i < 2 - thuPMCount; i++) {
        const availCands = cands.filter(c => schedule.data[c].Thursday[fixedPeriod] !== '群石墨修改')
        const chosen = pickPerson(availCands, taskConfigs['群石墨修改'].weight)
        if (!chosen)
          return false
        schedule.data[chosen].Thursday[fixedPeriod] = '群石墨修改'
      }
    }

    const satPMCount = STAFF.filter(p => schedule.data[p].Saturday[fixedPeriod] === '群石墨修改').length
    if (satPMCount < 1) {
      const cands = STAFF.filter(p => !((schedule as any)[`_rest_${p}`].includes('Saturday')) && !isManual(p, 'Saturday', fixedPeriod) && schedule.data[p].Saturday[fixedPeriod] === '')
      if (cands.length < 1 - satPMCount)
        return false
      const chosen = pickPerson(cands, taskConfigs['群石墨修改'].weight)
      if (!chosen)
        return false
      schedule.data[chosen].Saturday[fixedPeriod] = '群石墨修改'
    }
  }

  // --- 4. 安排每日基础 (限制度较高) ---
  if (hasRule('daily_basic')) {
    for (const d of DAYS) {
      const assignDaily = (task: TaskName, fallbackPeriod: 'AM' | 'PM' | 'NIGHT', overridePeriod?: 'AM' | 'PM' | 'NIGHT') => {
        const period = overridePeriod || getTaskPeriod(taskConfigs, task, fallbackPeriod)
        if (STAFF.some(p => schedule.data[p][d][period] === task))
          return true
        const cands = STAFF.filter((p) => {
          if (((schedule as any)[`_rest_${p}`] as DayOfWeek[]).includes(d))
            return false
          if (isManual(p, d, period))
            return false
          if (schedule.data[p][d][period] !== '')
            return false

          // 校验同一个人一天不能同时出现随访上午、随访下午和随访夜。
          // 注：因为8天休假分在7天，必有1天仅2人上班。这2人需承担3个随访，必有1人承担2个随访。
          // 因此只能限制“不能一个人包揽3个随访”。
          const isSuiFang = (t: string) => t === '随访上午' || t === '随访下午' || t === '随访夜'
          if (isSuiFang(task)) {
            let count = 0
            if (isSuiFang(schedule.data[p][d].AM))
              count++
            if (isSuiFang(schedule.data[p][d].PM))
              count++
            if (isSuiFang(schedule.data[p][d].NIGHT))
              count++
            if (count >= 2) {
              return false // 已经有2个随访了，禁止再接变成3个
            }
          }

          if (period === 'AM') {
            const prevDay = getPrevDay(d)
            const prevNIGHT = prevDay ? schedule.data[p][prevDay].NIGHT : context.sundayNIGHT[p]
            const prevAM = prevDay ? schedule.data[p][prevDay].AM : context.sundayAM[p]
            if (hasRule('night_fatigue') && prevNIGHT === '随访夜')
              return false
            if (hasRule('am_fatigue') && isAMFatigueTask(prevAM) && isAMFatigueTask(task))
              return false
          }
          return true
        })
        if (cands.length === 0)
          return false
        const chosen = pickPerson(cands, taskConfigs[task].weight)
        if (!chosen)
          return false
        schedule.data[chosen][d][period] = task
        return true
      }

      if (d === 'Saturday') {
        if (!assignDaily('随访上午', 'AM'))
          return false
        if (!assignDaily('随访下午', 'PM'))
          return false
        if (!assignDaily('随访夜', 'NIGHT'))
          return false
        // 特判周六基础班：随机尝试AM或PM，一旦成功即返回
        const isAM = Math.random() > 0.5
        let ok = assignDaily('基础班', 'PM', isAM ? 'AM' : 'PM')
        if (!ok) {
          ok = assignDaily('基础班', 'PM', !isAM ? 'AM' : 'PM')
        }
        if (!ok)
          return false
      }
      else {
        if (!assignDaily('随访上午', 'AM'))
          return false
        if (!assignDaily('随访下午', 'PM'))
          return false
        if (!assignDaily('随访夜', 'NIGHT'))
          return false
        if (!assignDaily('基础班', 'PM'))
          return false
      }
    }
  }

  // --- 5. 安排部门必排 ---
  if (hasRule('dept_mandatory')) {
    const ydPeriod = getTaskPeriod(taskConfigs, '运动处方', 'PM')
    const hasYundong = STAFF.some(p => DAYS.some(d => schedule.data[p][d][ydPeriod] === '运动处方'))
    if (!hasYundong) {
      const slots = getAvailableSlots((_p, _d, period) => period === ydPeriod)
      const chosen = pickSlot(slots, taskConfigs['运动处方'].weight)
      if (!chosen)
        return false
      schedule.data[chosen.p][chosen.d][ydPeriod] = '运动处方'
    }

    const stPeriod = getTaskPeriod(taskConfigs, '舌苔评估', 'AM')
    const hasShetai = STAFF.some(p => DAYS.some(d => schedule.data[p][d][stPeriod] === '舌苔评估'))
    if (!hasShetai) {
      const slots = getAvailableSlots((p, d, period) => {
        if (period !== stPeriod)
          return false
        const prevDay = getPrevDay(d)
        const nextDay = getNextDay(d)
        const prevNIGHT = prevDay ? schedule.data[p][prevDay].NIGHT : context.sundayNIGHT[p]
        const prevAM = prevDay ? schedule.data[p][prevDay].AM : context.sundayAM[p]
        const nextAM = nextDay ? schedule.data[p][nextDay].AM : ('' as TaskName)

        if (hasRule('night_fatigue') && prevNIGHT === '随访夜')
          return false
        if (hasRule('am_fatigue') && (isAMFatigueTask(prevAM) || isAMFatigueTask(nextAM)))
          return false
        return true
      })
      const chosen = pickSlot(slots, taskConfigs['舌苔评估'].weight)
      if (!chosen)
        return false
      schedule.data[chosen.p][chosen.d][stPeriod] = '舌苔评估'
    }
  }

  // --- 6. 安排个人必排 ---
  if (hasRule('personal_mandatory')) {
    for (const p of STAFF) {
      const assignPersonal = (task: TaskName) => {
        if (DAYS.some(d => schedule.data[p][d].AM === task || schedule.data[p][d].PM === task || schedule.data[p][d].NIGHT === task))
          return true
        const reqPeriod = taskConfigs[task].period
        let slots = getAvailableSlots((_p, d, _period) => _p === p && (reqPeriod === 'ANY' ? _period !== 'NIGHT' : _period === reqPeriod) && schedule.data[p][d][_period] === '')
        if (slots.length === 0)
          slots = getAvailableSlots((_p, _d, _period) => _p === p && (reqPeriod === 'ANY' ? _period !== 'NIGHT' : _period === reqPeriod))
        if (slots.length === 0)
          return false
        // 针对单人的任务无需跨人均衡，直接随机安排
        const chosen = slots[Math.floor(Math.random() * slots.length)]!
        currentWorkload[chosen.p] += taskConfigs[task].weight
        schedule.data[chosen.p][chosen.d][chosen.period] = task
        return true
      }
      if (!assignPersonal('电话'))
        return false
      if (!assignPersonal('筛查'))
        return false
    }
  }

  return validateSchedule(schedule, context, isManual, activeRules, restDaysConfig, taskConfigs)
}

export function verifySchedule(
  schedule: WeekSchedule,
  activeRules: string[],
  taskConfigs: Record<TaskName, TaskInfo>,
): { valid: boolean, errors: string[] } {
  const errors: string[] = []
  const hasRule = (rule: string) => activeRules.includes(rule)
  const context = getPrevWeekContext(schedule.weekStartDate)
  const restDaysConfig = schedule.restDays || { 组长: 1, 成员A: 2, 成员B: 2, 成员C: 2 }

  // 1. 检查未排满的单元格
  let hasEmpty = false
  for (const p of STAFF) {
    for (const d of DAYS) {
      if (schedule.data[p][d].AM === '' || schedule.data[p][d].PM === '' || schedule.data[p][d].NIGHT === '') {
        hasEmpty = true
      }
    }
  }
  if (hasEmpty) {
    errors.push('排班表未排满（存在"未设置"的单元格）')
  }

  // 2. 每日基础
  if (hasRule('daily_basic')) {
    for (const d of DAYS) {
      let sfam = 0; let sfpm = 0; let sfnight = 0; let jc = 0
      for (const p of STAFF) {
        if (schedule.data[p][d][getTaskPeriod(taskConfigs, '随访上午', 'AM')] === '随访上午')
          sfam++
        if (schedule.data[p][d][getTaskPeriod(taskConfigs, '随访下午', 'PM')] === '随访下午')
          sfpm++
        if (schedule.data[p][d][getTaskPeriod(taskConfigs, '随访夜', 'NIGHT')] === '随访夜')
          sfnight++
        if (d === 'Saturday') {
          if (schedule.data[p][d].AM === '基础班' || schedule.data[p][d].PM === '基础班')
            jc++
        }
        else {
          if (schedule.data[p][d][getTaskPeriod(taskConfigs, '基础班', 'PM')] === '基础班')
            jc++
        }

        const isSuiFang = (t: string) => t === '随访上午' || t === '随访下午' || t === '随访夜'
        let suiFangCount = 0
        if (isSuiFang(schedule.data[p][d].AM))
          suiFangCount++
        if (isSuiFang(schedule.data[p][d].PM))
          suiFangCount++
        if (isSuiFang(schedule.data[p][d].NIGHT))
          suiFangCount++
        if (suiFangCount > 2)
          errors.push(`${DAY_LABELS[d]} ${p} 一个人包揽了3个随访`)
      }
      if (sfam !== 1 || sfpm !== 1 || sfnight !== 1 || jc !== 1) {
        errors.push(`${DAY_LABELS[d]} 基础班或随访数量不符合每日必排规则`)
      }
    }
  }

  // 3. 部门必排
  if (hasRule('dept_mandatory')) {
    let yd = 0; let st = 0
    const ydPeriod = getTaskPeriod(taskConfigs, '运动处方', 'PM')
    const stPeriod = getTaskPeriod(taskConfigs, '舌苔评估', 'AM')
    for (const p of STAFF) {
      for (const d of DAYS) {
        if (schedule.data[p][d][ydPeriod] === '运动处方')
          yd++
        if (schedule.data[p][d][stPeriod] === '舌苔评估')
          st++
      }
    }
    if (yd < 1)
      errors.push('每周部门需完成 1 次运动处方')
    if (st < 1)
      errors.push('每周部门需完成 1 次舌苔评估')
  }

  // 4. 固定任务
  if (hasRule('fixed_tasks')) {
    let thu = 0; let sat = 0
    const fixedPeriod = getTaskPeriod(taskConfigs, '群石墨修改', 'PM')
    for (const p of STAFF) {
      if (schedule.data[p].Thursday[fixedPeriod] === '群石墨修改')
        thu++
      if (schedule.data[p].Saturday[fixedPeriod] === '群石墨修改')
        sat++
    }
    if (thu < 2)
      errors.push('周四需要 2 人负责群石墨修改')
    if (sat < 1)
      errors.push('周六需要 1 人负责群石墨修改')
  }

  // 5. 个人必排与休假、疲劳
  const isAMFatigue = (task: string) => task === '随访上午' || task === '舌苔评估' || task === '门诊'

  for (const p of STAFF) {
    if (hasRule('personal_mandatory')) {
      let dh = 0; let sc = 0
      for (const d of DAYS) {
        if (schedule.data[p][d].AM === '电话' || schedule.data[p][d].PM === '电话' || schedule.data[p][d].NIGHT === '电话')
          dh++
        if (schedule.data[p][d].AM === '筛查' || schedule.data[p][d].PM === '筛查' || schedule.data[p][d].NIGHT === '筛查')
          sc++
      }
      if (dh !== 1)
        errors.push(`${p} 每周必须且只能排 1 次电话`)
      if (sc !== 1)
        errors.push(`${p} 每周必须且只能排 1 次筛查`)
    }

    let emptyDays = 0
    const emptyDayList: DayOfWeek[] = []
    for (const d of DAYS) {
      const am = schedule.data[p][d].AM
      const pm = schedule.data[p][d].PM
      const night = schedule.data[p][d].NIGHT
      const hasRest = am === '休假' || pm === '休假' || night === '休假'
      const allRest = am === '休假' && pm === '休假' && night === '休假'

      if (hasRest && !allRest)
        errors.push(`${DAY_LABELS[d]} ${p} 存在半天休假，休假必须全天`)
      if (allRest) {
        emptyDays++
        emptyDayList.push(d)
      }
    }
    if (emptyDays !== restDaysConfig[p]) {
      errors.push(`${p} 的休假天数应为 ${restDaysConfig[p]} 天，实际为 ${emptyDays} 天`)
    }

    if (hasRule('consecutive_rest') && restDaysConfig[p] === 2 && emptyDays === 2) {
      const d1 = emptyDayList[0]!
      const d2 = emptyDayList[1]!
      const isConsecutive = DAYS.indexOf(d2) - DAYS.indexOf(d1) === 1
      const isEnds = d1 === 'Monday' && d2 === 'Sunday'
      if (!isConsecutive && !isEnds)
        errors.push(`${p} 的两天休假必须连续`)
    }

    if (hasRule('night_fatigue')) {
      if (context.sundayNIGHT[p] === '随访夜' && isAMFatigue(schedule.data[p].Monday.AM)) {
        errors.push(`${p} 上周日排了随访夜，本周一上午不能排疲劳任务`)
      }
      for (let i = 0; i < 6; i++) {
        const d = DAYS[i]!
        const nextD = DAYS[i + 1]!
        if (schedule.data[p][d].NIGHT === '随访夜' && isAMFatigue(schedule.data[p][nextD].AM)) {
          errors.push(`${DAY_LABELS[d]} ${p} 排了随访夜，次日上午不能排疲劳任务`)
        }
      }
    }

    if (hasRule('am_fatigue')) {
      if (isAMFatigue(context.sundayAM[p]) && isAMFatigue(schedule.data[p].Monday.AM)) {
        errors.push(`${p} 跨周连续两天的上午排了疲劳任务`)
      }
      for (let i = 0; i < 6; i++) {
        const d = DAYS[i]!
        const nextD = DAYS[i + 1]!
        if (isAMFatigue(schedule.data[p][d].AM) && isAMFatigue(schedule.data[p][nextD].AM)) {
          errors.push(`${p} 在 ${DAY_LABELS[d]} 和 ${DAY_LABELS[nextD]} 连续两天的上午排了疲劳任务`)
        }
      }
    }
  }

  const uniqueErrors = [...new Set(errors)]
  return { valid: uniqueErrors.length === 0, errors: uniqueErrors }
}

function validateSchedule(
  schedule: WeekSchedule,
  context: PrevWeekContext,
  isManual: (person: StaffName, day: DayOfWeek, period: 'AM' | 'PM' | 'NIGHT') => boolean,
  activeRules: string[],
  restDaysConfig: Record<StaffName, number>,
  taskConfigs: Record<TaskName, TaskInfo>,
): boolean {
  const hasRule = (rule: string) => activeRules.includes(rule)

  if (hasRule('daily_basic')) {
    for (const d of DAYS) {
      let sfam = 0
      let sfpm = 0
      let sfnight = 0
      let jc = 0
      for (const p of STAFF) {
        if (schedule.data[p][d][getTaskPeriod(taskConfigs, '随访上午', 'AM')] === '随访上午')
          sfam++
        if (schedule.data[p][d][getTaskPeriod(taskConfigs, '随访下午', 'PM')] === '随访下午')
          sfpm++
        if (schedule.data[p][d][getTaskPeriod(taskConfigs, '随访夜', 'NIGHT')] === '随访夜')
          sfnight++
        if (d === 'Saturday') {
          if (schedule.data[p][d].AM === '基础班' || schedule.data[p][d].PM === '基础班')
            jc++
        }
        else {
          if (schedule.data[p][d][getTaskPeriod(taskConfigs, '基础班', 'PM')] === '基础班')
            jc++
        }

        // 校验同一个人一天不能同时包揽3个随访
        const isSuiFang = (t: string) => t === '随访上午' || t === '随访下午' || t === '随访夜'
        let suiFangCount = 0
        if (isSuiFang(schedule.data[p][d].AM))
          suiFangCount++
        if (isSuiFang(schedule.data[p][d].PM))
          suiFangCount++
        if (isSuiFang(schedule.data[p][d].NIGHT))
          suiFangCount++
        if (suiFangCount > 2)
          return false
      }
      if (sfam !== 1 || sfpm !== 1 || sfnight !== 1 || jc !== 1)
        return false
    }
  }

  if (hasRule('dept_mandatory')) {
    let yundongCount = 0
    let shetaiCount = 0
    const ydPeriod = getTaskPeriod(taskConfigs, '运动处方', 'PM')
    const stPeriod = getTaskPeriod(taskConfigs, '舌苔评估', 'AM')
    for (const p of STAFF) {
      for (const d of DAYS) {
        if (schedule.data[p][d][ydPeriod] === '运动处方')
          yundongCount++
        if (schedule.data[p][d][stPeriod] === '舌苔评估')
          shetaiCount++
      }
    }
    if (yundongCount < 1 || shetaiCount < 1)
      return false
  }

  if (hasRule('fixed_tasks')) {
    let thuPMCount = 0
    let satPMCount = 0
    const fixedPeriod = getTaskPeriod(taskConfigs, '群石墨修改', 'PM')
    for (const p of STAFF) {
      if (schedule.data[p].Thursday[fixedPeriod] === '群石墨修改')
        thuPMCount++
      if (schedule.data[p].Saturday[fixedPeriod] === '群石墨修改')
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
      const night = schedule.data[p][d].NIGHT

      // 绝不可出现部分休假的情况（除非手动安排，否则算法生成禁止）
      const hasRest = am === '休假' || pm === '休假' || night === '休假'
      const allRest = am === '休假' && pm === '休假' && night === '休假'
      if (hasRest && !allRest)
        return false

      if (allRest) {
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
      if (context.sundayNIGHT[p] === '随访夜' && isAMFatigueTask(schedule.data[p].Monday.AM)) {
        if (!isManual(p, 'Monday', 'AM'))
          return false
      }
      for (let i = 0; i < 6; i++) {
        const d = DAYS[i]!
        const nextD = DAYS[i + 1]!
        if (schedule.data[p][d].NIGHT === '随访夜' && isAMFatigueTask(schedule.data[p][nextD].AM)) {
          if (!isManual(p, d, 'NIGHT') || !isManual(p, nextD, 'AM'))
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
