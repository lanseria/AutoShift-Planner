<script setup lang="ts">
import { STAFF } from '~/types/schedule'

const store = useScheduleStore()
</script>

<template>
  <div
    class="w-full rounded-lg border bg-white overflow-hidden"
    :class="store.isUnbalanced ? 'border-red-500' : 'border-gray-200'"
  >
    <div class="px-4 py-3 border-b border-gray-100">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-900">
          工作量统计
        </h3>
        <span
          v-if="store.isUnbalanced"
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white"
        >
          分配不均 (差值 {{ store.workloadDiff.toFixed(1) }})
        </span>
      </div>
    </div>
    <div class="p-4">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="person in STAFF"
          :key="person"
          class="flex flex-col items-center p-3 rounded-lg bg-gray-50"
        >
          <span class="font-medium text-gray-700">{{ person }}</span>
          <span class="text-2xl font-bold mt-1 text-gray-900">
            {{ store.workload[person]?.toFixed(1) ?? '0.0' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
