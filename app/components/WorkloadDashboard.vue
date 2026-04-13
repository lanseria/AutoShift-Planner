<script setup lang="ts">
import type { StaffName } from '~/types/schedule'
import { computed } from 'vue'
import { STAFF } from '~/types/schedule'

const props = defineProps<{
  workload: Record<StaffName, number>
}>()

const diff = computed(() => {
  const values = Object.keys(props.workload)
    .filter(p => p !== '组长')
    .map(p => props.workload[p as StaffName] || 0)
  if (values.length === 0)
    return 0
  return Math.max(...values) - Math.min(...values)
})
</script>

<template>
  <div class="text-sm px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
    <div class="flex flex-wrap gap-4 items-center sm:gap-6">
      <div v-for="person in STAFF" :key="person" class="flex gap-1.5 items-center">
        <span class="text-gray-500">{{ person }}:</span>
        <span class="text-gray-900 font-medium">{{ (props.workload[person] || 0).toFixed(1) }}</span>
      </div>
    </div>
    <div class="flex gap-2 items-center">
      <span class="text-gray-500">成员差值:</span>
      <span class="text-blue-600 font-bold px-2 py-0.5 rounded bg-blue-100/50">{{ diff.toFixed(1) }}</span>
    </div>
  </div>
</template>
