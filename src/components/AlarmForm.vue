<template>
  <div class="add-alarm-form">
    <div class="form-group">
      <label>时间 (HH:MM)</label>
      <div class="time-row">
        <div class="select-wrap">
          <select class="ui-select" v-model="newHour" aria-label="小时">
            <option v-for="h in hourOptions" :key="h" :value="h">{{ h }}</option>
          </select>
        </div>
        <div class="time-sep">:</div>
        <div class="select-wrap">
          <select class="ui-select" v-model="newMinute" aria-label="分钟">
            <option v-for="m in minuteOptions" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>标签</label>
      <input class="ui-input" type="text" v-model="form.label" placeholder="如：起床" />
    </div>
    <div class="form-group">
      <label>持续时间（分钟）</label>
      <div class="duration-row">
        <input class="ui-input" type="number" min="1" max="1440" step="1" v-model.number="form.durationMinutes" />
        <span class="unit">分钟</span>
      </div>
    </div>
    <div class="form-group">
      <label>周期</label>
      <div class="select-wrap">
        <select class="ui-select" v-model="form.recurrence">
          <option v-for="item in recurrenceOptions" :key="item.value" :value="item.value">
            {{ item.label }}
          </option>
        </select>
      </div>
    </div>
    <div class="form-group row-group">
      <label class="ringtone-label">铃声: <span class="ringtone-name">{{ form.ringtoneName || '默认铃声' }}</span></label>
      <div style="display:flex; gap:8px; align-items:center;">
        <button class="select-btn" @click="selectRingtoneFile">选择文件</button>
        <button class="select-btn" @click="$emit('preview-play', form.ringtone)">试听</button>
        <button class="select-btn" @click="$emit('preview-stop')">停止</button>
        <div style="display:flex; flex-direction:column; align-items:flex-start;">
          <input type="range" min="0" max="1" step="0.01" :value="volume" @input="$emit('update:volume', Number(($event.target as HTMLInputElement).value))" />
          <div style="font-size:0.75rem; color:var(--text-secondary);">音量: {{ Math.round(volume * 100) }}%</div>
        </div>
      </div>
    </div>
    <div class="form-actions">
      <button class="cancel-btn" @click="$emit('cancel')">取消</button>
      <button class="save-btn" @click="handleSave">保存</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  type RecurrenceType,
  recurrenceOptions,
  hourOptions,
  minuteOptions,
  generateId,
} from '@/utils/alarm';

defineProps<{
  volume: number;
}>();

const emit = defineEmits<{
  save: [alarm: Alarm];
  cancel: [];
  'preview-play': [ringtonePath: string];
  'preview-stop': [];
  'update:volume': [value: number];
}>();

const newHour = ref('08');
const newMinute = ref('00');
const form = ref({
  label: '未命名',
  ringtone: '',
  ringtoneName: '',
  durationMinutes: 1,
  recurrence: 'once' as RecurrenceType,
});

const selectRingtoneFile = async () => {
  if (window.electronAPI) {
    const filePath = await window.electronAPI.selectRingtone();
    if (filePath) {
      form.value.ringtone = filePath;
      const parts = filePath.split(/[/\\]/);
      form.value.ringtoneName = parts[parts.length - 1];
    }
  }
};

const handleSave = () => {
  const alarm: Alarm = {
    id: generateId(),
    time: `${newHour.value}:${newMinute.value}`,
    label: form.value.label || '事件',
    enabled: true,
    ringtone: form.value.ringtone,
    ringtoneName: form.value.ringtoneName,
    durationMinutes: Math.max(1, Number(form.value.durationMinutes || 1)),
    recurrence: form.value.recurrence,
    lastTriggeredDate: '',
    createdAt: Date.now(),
  };
  emit('save', alarm);

  // Reset form
  form.value = { label: '未命名', ringtone: '', ringtoneName: '', durationMinutes: 1, recurrence: 'once' };
  newHour.value = '08';
  newMinute.value = '00';
};
</script>

<style scoped>
.add-alarm-form {
  background: var(--panel-bg);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border: 1px solid var(--border-color);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group.row-group {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.form-group label {
  font-size: 0.9rem;
  color: var(--text-color);
}

.ringtone-name {
  color: var(--accent-color);
  font-size: 0.85rem;
}

.ui-input {
  width: 100%;
  box-sizing: border-box;
  background: #f1f5f9;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 10px 12px;
  border-radius: 10px;
  outline: none;
  font-size: 1rem;
  font-family: inherit;
  transition: 0.25s;
}

.ui-input:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
}

.ui-input[type="number"]::-webkit-outer-spin-button,
.ui-input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.ui-input[type="number"] {
  -moz-appearance: textfield;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.time-sep {
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-secondary);
  font-weight: 600;
}

.select-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.ui-select {
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background: #f1f5f9;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 10px 38px 10px 12px;
  border-radius: 10px;
  outline: none;
  font-size: 1rem;
  transition: 0.25s;
  cursor: pointer;
}

.ui-select:focus {
  border-color: var(--accent-color);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
}

.select-wrap::after {
  content: "";
  position: absolute;
  right: 12px;
  top: 50%;
  width: 10px;
  height: 10px;
  border-right: 2px solid rgba(100, 116, 139, 0.9);
  border-bottom: 2px solid rgba(100, 116, 139, 0.9);
  transform: translateY(-65%) rotate(45deg);
  pointer-events: none;
}

.duration-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.unit {
  font-size: 0.9rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.select-btn {
  background: #f1f5f9;
  border: 1px solid var(--border-color);
  color: var(--text-color);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.select-btn:hover { background: #e2e8f0; }

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 10px;
}

.cancel-btn, .save-btn {
  flex: 1;
  padding: 10px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 500;
  transition: 0.2s;
}

.cancel-btn {
  background: #e2e8f0;
  color: var(--text-color);
}
.cancel-btn:hover { background: #cbd5e1; }

.save-btn {
  background: var(--accent-color);
  color: #ffffff;
}
.save-btn:hover {
  background: #2563eb;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}
</style>
