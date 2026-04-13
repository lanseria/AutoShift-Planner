<!-- eslint-disable no-alert -->
<script setup lang="ts">
import type { TaskInfo, TaskName } from '~/types/schedule'
import { ref, watch } from 'vue'
import { useScheduleStore } from '~/stores/schedule'
import { DEFAULT_TASKS } from '~/types/schedule'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ (e: 'update:modelValue', val: boolean): void }>()
const store = useScheduleStore()

const editableConfigs = ref<Record<TaskName, TaskInfo>>(JSON.parse(JSON.stringify(store.taskConfigs)))

// 过滤掉不可编辑的系统项（如空值或纯休假项可以限制）
const editableTasks = Object.keys(DEFAULT_TASKS).filter(k => k !== '' && k !== '休假') as TaskName[]

watch(() => props.modelValue, (val) => {
  if (val) {
    editableConfigs.value = JSON.parse(JSON.stringify(store.taskConfigs))
  }
})

function save() {
  store.saveTaskConfigs(editableConfigs.value)
  emit('update:modelValue', false)
}

function close() {
  emit('update:modelValue', false)
}

function resetToDefault() {
  if (confirm('确定要恢复默认的任务配置吗？')) {
    editableConfigs.value = JSON.parse(JSON.stringify(DEFAULT_TASKS))
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="flex items-center inset-0 justify-center fixed z-50">
      <div class="bg-black/40 inset-0 absolute backdrop-blur-sm" @click="close" />
      <div class="mx-4 rounded-xl bg-white flex flex-col max-h-[90vh] max-w-2xl w-full shadow-xl relative">
        <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-xl text-gray-900 font-bold flex gap-2 items-center">
            <div class="i-carbon-settings text-blue-500" />
            任务属性配置
          </h3>
          <button class="text-gray-400 p-2 rounded-lg transition-colors hover:text-gray-600 hover:bg-gray-100" @click="close">
            <div class="i-carbon-close text-xl" />
          </button>
        </div>

        <div class="p-6 overflow-y-auto">
          <div class="text-sm text-blue-800 mb-4 p-3 rounded-lg bg-blue-50 flex gap-2">
            <div class="i-carbon-information text-lg mt-0.5 shrink-0" />
            <p>更改任务的时段或权重后，自动排班算法将实时遵循新配置。若排班失败率变高，说明条件过于冲突，可尝试放宽时段限制（如设为不限）。</p>
          </div>

          <table class="text-sm text-left w-full">
            <thead class="text-xs text-gray-500 bg-gray-50 uppercase">
              <tr>
                <th class="px-4 py-3 rounded-tl-lg">
                  任务名称
                </th>
                <th class="px-4 py-3">
                  限制时段
                </th>
                <th class="px-4 py-3 rounded-tr-lg">
                  工作量权重
                </th>
              </tr>
            </thead>
            <tbody class="divide-gray-100 divide-y">
              <tr v-for="task in editableTasks" :key="task" class="transition-colors hover:bg-gray-50">
                <td class="text-gray-900 font-medium px-4 py-3">
                  {{ task }}
                </td>
                <td class="px-4 py-3">
                  <select
                    v-model="editableConfigs[task].period"
                    class="text-sm text-gray-900 p-2 outline-none border border-gray-200 rounded-lg bg-white w-full block focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="AM">
                      仅上午 (AM)
                    </option>
                    <option value="PM">
                      仅下午 (PM)
                    </option>
                    <option value="NIGHT">
                      仅晚上 (NIGHT)
                    </option>
                    <option value="ANY">
                      不限时段 (ANY)
                    </option>
                  </select>
                </td>
                <td class="px-4 py-3">
                  <input
                    v-model.number="editableConfigs[task].weight"
                    type="number"
                    step="0.1"
                    min="0"
                    class="text-sm text-gray-900 p-2 outline-none border border-gray-200 rounded-lg bg-white w-full block focus:border-blue-500 focus:ring-blue-500"
                  >
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="px-6 py-4 border-t border-gray-100 rounded-b-xl bg-gray-50 flex items-center justify-between">
          <button class="text-sm text-gray-600 font-medium px-4 py-2 transition-colors hover:text-gray-900" @click="resetToDefault">
            恢复默认
          </button>
          <div class="flex gap-3">
            <button class="text-sm text-gray-700 font-medium px-4 py-2 border border-gray-300 rounded-lg bg-white transition-colors hover:bg-gray-50" @click="close">
              取消
            </button>
            <button class="text-sm text-white font-medium px-4 py-2 rounded-lg bg-blue-500 shadow-sm transition-colors hover:bg-blue-600" @click="save">
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
