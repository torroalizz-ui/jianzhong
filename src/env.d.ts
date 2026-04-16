/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  getAlarms: () => Promise<Alarm[]>
  saveAlarms: (alarms: Alarm[]) => Promise<boolean>
  selectRingtone: () => Promise<string | null>
  getFileUrl: (path: string) => Promise<string | null>
  getFileDataUrl: (path: string) => Promise<string | null>
  getVolume: () => Promise<number>
  saveVolume: (volume: number) => Promise<void>
  windowMinimize: () => Promise<void>
  windowHide: () => Promise<void>
  windowClose: () => Promise<void>
  showNotification: (title: string, body: string) => Promise<void>
  showWindow: () => Promise<void>
}

interface Alarm {
  id: string
  time: string
  label: string
  enabled: boolean
  ringtone: string
  ringtoneName: string
  durationMinutes: number
  recurrence: 'once' | 'daily' | 'legalWorkday' | 'legalHoliday' | 'weekdays'
  lastTriggeredDate?: string
  createdAt: number
}

interface Window {
  electronAPI: ElectronAPI
}
