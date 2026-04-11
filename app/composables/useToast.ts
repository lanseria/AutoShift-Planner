import { ref } from 'vue'

export interface ToastMessage {
  id: number
  type: 'success' | 'error'
  message: string
}

const toasts = ref<ToastMessage[]>([])
let nextId = 0

export function useToast() {
  function show(type: 'success' | 'error', message: string) {
    const id = nextId++
    toasts.value.push({ id, type, message })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, 3000)
  }

  function success(message: string) {
    show('success', message)
  }

  function error(message: string) {
    show('error', message)
  }

  function remove(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    success,
    error,
    remove,
  }
}
