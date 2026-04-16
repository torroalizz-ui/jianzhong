<template>
  <div
    class="alarm-item"
    :class="{ 'is-disabled': !alarm.enabled, 'is-ringing': isRinging }"
  >
    <div class="alarm-info">
      <span class="alarm-time">{{ alarm.time }}</span>
      <span class="alarm-label">{{ alarm.label }}</span>
      <span class="alarm-meta" v-if="alarm.durationMinutes">
        持续 {{ alarm.durationMinutes }} 分钟
      </span>
      <span class="alarm-meta">
        周期：{{ getRecurrenceLabel(alarm.recurrence) }}
      </span>
      <span class="alarm-reminder" v-if="isRinging">
        正在提醒中...
      </span>
    </div>
    <div class="alarm-actions">
      <button
        v-if="isRinging"
        class="stop-inline-btn"
        @click="$emit('stop')"
        title="停止提醒"
      >
        停止
      </button>
      <label class="switch">
        <input
          type="checkbox"
          :checked="alarm.enabled"
          @change="$emit('toggle', alarm.id)"
        >
        <span class="slider round"></span>
      </label>
      <button
        class="icon-btn delete-btn"
        @click="$emit('delete', alarm.id)"
        title="删除"
      >✕</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getRecurrenceLabel } from '@/utils/alarm';

defineProps<{
  alarm: Alarm;
  isRinging: boolean;
}>();

defineEmits<{
  stop: [];
  toggle: [id: string];
  delete: [id: string];
}>();
</script>

<style scoped>
.alarm-item {
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s;
}

.alarm-item:hover {
  background: #f0f4f8;
}

.alarm-item.is-disabled {
  opacity: 0.5;
}

.alarm-item.is-ringing {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
}

.alarm-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.alarm-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.8rem;
  font-weight: 600;
}

.alarm-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.alarm-meta {
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.alarm-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.alarm-reminder {
  margin-top: 2px;
  color: var(--accent-color);
  font-size: 0.8rem;
  font-weight: 600;
}

.stop-inline-btn {
  border: none;
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger-color);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: 0.2s;
}

.stop-inline-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--danger-color);
  cursor: pointer;
  font-size: 1.2rem;
  opacity: 0.7;
  transition: 0.2s;
}

.icon-btn:hover {
  opacity: 1;
  transform: scale(1.1);
}

/* Toggle switch */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: .4s;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
}

input:checked + .slider {
  background-color: var(--active-color);
}

input:checked + .slider:before {
  transform: translateX(20px);
}

.slider.round {
  border-radius: 24px;
}

.slider.round:before {
  border-radius: 50%;
}
</style>
