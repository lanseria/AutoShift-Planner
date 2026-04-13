export type TaskName
  = | '门诊'
    | '随访上午'
    | '随访下午'
    | '随访夜'
    | '基础班'
    | '电话'
    | '筛查'
    | '运动处方'
    | '舌苔评估'
    | '群石墨修改'
    | '休假'
    | ''

export interface TaskInfo {
  name: TaskName
  period: 'AM' | 'PM' | 'NIGHT' | 'ANY'
  type: 'MANUAL' | 'AUTO' | 'MANDATORY' | 'DEPT_MANDATORY' | 'FIXED'
  weight: number
}

export const TASKS: Record<TaskName, TaskInfo> = {
  '门诊': { name: '门诊', period: 'ANY', type: 'MANUAL', weight: 1.0 },
  '随访上午': { name: '随访上午', period: 'AM', type: 'AUTO', weight: 1.0 },
  '随访下午': { name: '随访下午', period: 'PM', type: 'AUTO', weight: 0.4 },
  '随访夜': { name: '随访夜', period: 'NIGHT', type: 'AUTO', weight: 0.6 },
  '基础班': { name: '基础班', period: 'PM', type: 'AUTO', weight: 0.8 },
  '电话': { name: '电话', period: 'ANY', type: 'MANDATORY', weight: 1.0 },
  '筛查': { name: '筛查', period: 'ANY', type: 'MANDATORY', weight: 1.0 },
  '运动处方': { name: '运动处方', period: 'PM', type: 'DEPT_MANDATORY', weight: 0.5 },
  '舌苔评估': { name: '舌苔评估', period: 'AM', type: 'DEPT_MANDATORY', weight: 0.8 },
  '群石墨修改': { name: '群石墨修改', period: 'PM', type: 'FIXED', weight: 0.8 },
  '休假': { name: '休假', period: 'ANY', type: 'MANUAL', weight: 0 },
  '': { name: '', period: 'ANY', type: 'AUTO', weight: 0 },
}

export const STAFF = ['组长', '成员A', '成员B', '成员C'] as const
export type StaffName = typeof STAFF[number]

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'
export const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const DAY_LABELS: Record<DayOfWeek, string> = {
  Monday: '周一',
  Tuesday: '周二',
  Wednesday: '周三',
  Thursday: '周四',
  Friday: '周五',
  Saturday: '周六',
  Sunday: '周日',
}

export interface DaySchedule {
  AM: TaskName
  PM: TaskName
  NIGHT: TaskName
}

export type PersonSchedule = Record<DayOfWeek, DaySchedule>

export interface WeekSchedule {
  weekStartDate: string // YYYY-MM-DD
  data: Record<StaffName, PersonSchedule>
  restDays?: Record<StaffName, number> // 新增：单周每个人的休息天数配置
}
