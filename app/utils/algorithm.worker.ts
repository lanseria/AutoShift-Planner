import type { TaskInfo, TaskName, WeekSchedule } from '../types/schedule'
import type { PrevWeekContext } from './algorithm'
import { generateScheduleCore } from './algorithm'

interface WorkerInput {
  schedule: WeekSchedule
  activeRules: string[]
  context: PrevWeekContext
  taskConfigs: Record<TaskName, TaskInfo>
}

interface ProgressMessage {
  type: 'progress'
  progress: number
}

interface ResultMessage {
  type: 'result'
  data: ReturnType<typeof generateScheduleCore>
}

export type WorkerMessage = ProgressMessage | ResultMessage

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { schedule, activeRules, context, taskConfigs } = e.data

  const result = generateScheduleCore(schedule, activeRules, context, taskConfigs, (progress) => {
    self.postMessage({ type: 'progress', progress } satisfies ProgressMessage)
  })

  self.postMessage({ type: 'result', data: result } satisfies ResultMessage)
}
