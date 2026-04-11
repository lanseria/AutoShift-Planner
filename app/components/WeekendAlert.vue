<script setup lang="ts">
const store = useScheduleStore()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="store.showWeekendAlert"
      class="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        class="absolute inset-0 bg-black/40"
        @click="store.showWeekendAlert = false"
      />
      <div class="relative bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div class="flex items-center gap-2 mb-3">
          <div class="i-carbon-warning-alt text-red-500 text-xl" />
          <h3 class="text-lg font-semibold text-red-600">
            排班提醒
          </h3>
        </div>
        <p class="text-gray-600 mb-5">
          下周暂无排班，请尽快安排！
        </p>
        <div class="flex justify-end">
          <button
            class="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
            @click="store.goToNextWeek()"
          >
            去排班
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
