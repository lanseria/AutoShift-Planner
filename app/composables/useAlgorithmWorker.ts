import type { WeekSchedule } from '~/types/schedule'
import type { PrevWeekContext, ScheduleGroup } from '~/utils/algorithm'
import SharedWorker from '../utils/algorithm.worker.ts?worker'

export function useAlgorithmWorker() {
  const progress = ref(0)
  const isGenerating = ref(false)

  function run(
    schedule: WeekSchedule,
    activeRules: string[],
    context: PrevWeekContext,
    taskConfigs: Record<string, any>,
  ): Promise<ScheduleGroup[] | null> {
    return new Promise((resolve) => {
      isGenerating.value = true
      progress.value = 0

      const worker = new SharedWorker()

      worker.onmessage = (e) => {
        if (e.data.type === 'progress') {
          progress.value = e.data.progress
        }
        else if (e.data.type === 'result') {
          worker.terminate()
          isGenerating.value = false
          progress.value = 100
          resolve(e.data.data)
        }
      }

      worker.onerror = () => {
        worker.terminate()
        isGenerating.value = false
        progress.value = 0
        resolve(null)
      }

      // Vue reactive proxy 无法被 postMessage 结构化克隆，需先深拷贝为普通对象
      const payload = JSON.parse(JSON.stringify({ schedule, activeRules, context, taskConfigs }))
      worker.postMessage(payload)
    })
  }

  return { progress, isGenerating, run }
}
