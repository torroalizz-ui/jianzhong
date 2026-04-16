<template>
  <div class="app-container">
    <!-- Titlebar (Draggable) -->
    <div class="titlebar">
      <div class="title">简钟</div>
      <div class="titlebar-controls">
        <button class="control-btn btn-minimize" @click="minimizeWindow" title="最小化"></button>
        <button class="control-btn btn-close" @click="hideWindow" title="隐藏到托盘"></button>
      </div>
    </div>

    <!-- Main interface -->
    <div class="main-content">
      <!-- Digital Clock -->
      <div class="clock-display">
        {{ currentTime }}
      </div>

      <!-- Alarms List -->
      <div class="alarms-list">
        <div v-if="alarms.length === 0" class="empty-state">
          无事件，点击下方添加
        </div>
        <AlarmItem
          v-for="alarm in alarms"
          :key="alarm.id"
          :alarm="alarm"
          :is-ringing="activeRingingAlarm?.id === alarm.id"
          @stop="stopRinging"
          @toggle="toggleAlarm"
          @delete="deleteAlarm"
        />
      </div>

      <!-- Add New Alarm Section -->
      <div class="actions-area" v-if="!isAdding">
        <button class="add-btn" @click="isAdding = true">+ 新建事件</button>
      </div>

      <!-- Add Alarm Form -->
      <AlarmForm
        v-if="isAdding"
        v-model:volume="ringtoneVolume"
        @save="addAlarm"
        @cancel="isAdding = false"
        @preview-play="playPreview"
        @preview-stop="stopPreview"
      />
    </div>

    <!-- Audio Player (Hidden) -->
    <audio ref="audioPlayer" loop></audio>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import AlarmItem from '@/components/AlarmItem.vue';
import AlarmForm from '@/components/AlarmForm.vue';
import {
  type RecurrenceType,
  DEFAULT_RINGTONE_SRC,
  toDateKey,
  shouldTriggerForDate,
} from '@/utils/alarm';

const currentTime = ref('');
const alarms = ref<Alarm[]>([]);
const isAdding = ref(false);
const audioPlayer = ref<HTMLAudioElement | null>(null);
const activeRingingAlarm = ref<Alarm | null>(null);
const ringtoneVolume = ref(0.8);

let clockTimer: number;
let alarmCheckTimer: number;
let beepContext: AudioContext | null = null;
let beepOsc: OscillatorNode | null = null;
let beepGain: GainNode | null = null;
let ringingStopTimer: number | null = null;

// #1 fix: track last checked minute to avoid missing the exact second === 0
let lastCheckedMinute = '';

/* ---- Data persistence ---- */

const loadAlarms = async () => {
  if (window.electronAPI) {
    const storedAlarms = await window.electronAPI.getAlarms();
    if (storedAlarms) {
      const normalized = storedAlarms.map((alarm) => ({
        ...alarm,
        durationMinutes: Math.max(1, Number(alarm.durationMinutes || 1)),
        recurrence: (alarm.recurrence || 'once') as RecurrenceType,
        lastTriggeredDate: alarm.lastTriggeredDate || '',
      }));
      alarms.value = normalized;
      // #8 fix: only write back if normalization actually changed the data
      if (JSON.stringify(normalized) !== JSON.stringify(storedAlarms)) {
        await window.electronAPI.saveAlarms(normalized);
      }
    }

    // #7 fix: load persisted volume
    try {
      const savedVolume = await window.electronAPI.getVolume();
      if (typeof savedVolume === 'number' && savedVolume >= 0 && savedVolume <= 1) {
        ringtoneVolume.value = savedVolume;
      }
    } catch {
      // use default
    }
  }
};

const saveAlarms = async () => {
  if (window.electronAPI) {
    await window.electronAPI.saveAlarms(alarms.value);
  }
};

/* ---- Clock ---- */

const updateClock = () => {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

/* ---- Alarm checking ---- */

const checkAlarms = async () => {
  const now = new Date();
  const today = toDateKey(now);
  const currentHHMM = now.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });

  // #1 fix: use lastCheckedMinute instead of seconds === 0
  // This prevents missing triggers if the event loop was busy at exact second 0
  if (currentHHMM === lastCheckedMinute) return;
  lastCheckedMinute = currentHHMM;

  // #2 fix: process ALL matching alarms, not just the first one
  let needsSave = false;

  for (const alarm of alarms.value) {
    if (!alarm.enabled || alarm.time !== currentHHMM) continue;
    if (!shouldTriggerForDate(alarm.recurrence || 'once', now)) continue;
    if (alarm.lastTriggeredDate === today) continue;

    // Mark as triggered
    alarm.lastTriggeredDate = today;
    if ((alarm.recurrence || 'once') === 'once') {
      alarm.enabled = false;
    }
    needsSave = true;

    // Send notification for every matching alarm
    if (window.electronAPI) {
      window.electronAPI.showNotification('事件开始', alarm.label);
    }

    // Only play audio for the first matching alarm (one ring at a time)
    if (!activeRingingAlarm.value) {
      void triggerAlarmAudio(alarm);
    }
  }

  if (needsSave) {
    try {
      await saveAlarms();
    } catch (e) {
      console.error('Failed to save alarms after triggering:', e);
    }
  }
};

/* ---- Audio playback ---- */

const triggerAlarmAudio = async (alarm: Alarm) => {
  activeRingingAlarm.value = alarm;

  // Auto-stop after duration
  if (ringingStopTimer) {
    clearTimeout(ringingStopTimer);
    ringingStopTimer = null;
  }
  const durationMs = Math.max(1, Number(alarm.durationMinutes || 1)) * 60_000;
  ringingStopTimer = window.setTimeout(() => {
    stopRinging();
  }, durationMs);

  if (audioPlayer.value) {
    stopBeep();
    let finalSrc = DEFAULT_RINGTONE_SRC;
    if (alarm.ringtone && window.electronAPI) {
      try {
        const url = await getFileUrlFromMain(alarm.ringtone);
        if (url) finalSrc = url;
      } catch (e) {
        console.error('Failed to get file url for alarm ringtone:', e);
      }
    }
    audioPlayer.value.src = finalSrc;
    audioPlayer.value.volume = Math.max(0, Math.min(1, ringtoneVolume.value));
    audioPlayer.value.play().catch(e => {
      console.error('Audio play failed:', e);
      try { audioPlayer.value?.removeAttribute('src'); } catch {}
      startBeep();
    });
  }
};

const getFileUrlFromMain = async (p?: string) => {
  if (!p) return null;
  if (!window.electronAPI) return null;
  try {
    if (window.electronAPI.getFileDataUrl) {
      try {
        const dataUrl = await window.electronAPI.getFileDataUrl(p);
        if (dataUrl) return dataUrl;
      } catch (e) {
        console.error('getFileDataUrl failed:', e);
      }
    }
    const url = await window.electronAPI.getFileUrl(p);
    return url;
  } catch (e) {
    console.error('getFileUrlFromMain failed:', e);
    return null;
  }
};

const startBeep = () => {
  try {
    if (!beepContext) {
      beepContext = new AudioContext();
    }
    if (beepContext.state === 'suspended') {
      void beepContext.resume();
    }
    stopBeep();

    beepOsc = beepContext.createOscillator();
    beepGain = beepContext.createGain();

    beepOsc.type = 'sine';
    beepOsc.frequency.value = 880;

    const t0 = beepContext.currentTime;
    const amp = 0.18 * Math.max(0, Math.min(1, ringtoneVolume.value));
    beepGain.gain.setValueAtTime(0.0, t0);
    for (let i = 0; i < 120; i++) {
      const t = t0 + i * 0.5;
      beepGain.gain.setValueAtTime(0.0, t);
      beepGain.gain.linearRampToValueAtTime(amp, t + 0.02);
      beepGain.gain.setValueAtTime(amp, t + 0.22);
      beepGain.gain.linearRampToValueAtTime(0.0, t + 0.26);
    }

    beepOsc.connect(beepGain);
    beepGain.connect(beepContext.destination);
    beepOsc.start();
  } catch (e) {
    console.error('Beep failed:', e);
  }
};

// #7 fix: persist volume changes
watch(ringtoneVolume, (nv) => {
  try {
    if (audioPlayer.value) {
      audioPlayer.value.volume = Math.max(0, Math.min(1, nv));
    }
  } catch {}
  try {
    if (beepGain && beepContext) {
      const now = beepContext.currentTime;
      const amp = 0.18 * Math.max(0, Math.min(1, nv));
      beepGain.gain.setValueAtTime(amp, now);
    }
  } catch {}
  // Persist volume
  if (window.electronAPI) {
    window.electronAPI.saveVolume(nv).catch(() => {});
  }
});

const stopBeep = () => {
  try {
    if (beepOsc) {
      beepOsc.stop();
      beepOsc.disconnect();
    }
  } catch {
    // ignore
  } finally {
    beepOsc = null;
  }
  try {
    if (beepGain) beepGain.disconnect();
  } catch {
    // ignore
  } finally {
    beepGain = null;
  }
};

const stopRinging = () => {
  activeRingingAlarm.value = null;
  if (ringingStopTimer) {
    clearTimeout(ringingStopTimer);
    ringingStopTimer = null;
  }
  stopBeep();
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value.currentTime = 0;
  }
};

/* ---- Preview (used by AlarmForm) ---- */

const playPreview = async (ringtonePath: string) => {
  if (!audioPlayer.value) return;
  let src = DEFAULT_RINGTONE_SRC;
  if (ringtonePath) {
    const url = await getFileUrlFromMain(ringtonePath);
    if (url) src = url;
  }
  try {
    audioPlayer.value.src = src;
    audioPlayer.value.volume = Math.max(0, Math.min(1, ringtoneVolume.value));
    await audioPlayer.value.play();
  } catch (e) {
    console.error('Preview play failed, fallback to beep:', e);
    try { audioPlayer.value.removeAttribute('src'); } catch {}
    startBeep();
  }
};

const stopPreview = () => {
  if (!audioPlayer.value) return;
  try {
    audioPlayer.value.pause();
    audioPlayer.value.currentTime = 0;
  } catch {}
  stopBeep();
};

/* ---- Lifecycle ---- */

onMounted(() => {
  loadAlarms();
  updateClock();
  clockTimer = window.setInterval(updateClock, 1000);
  alarmCheckTimer = window.setInterval(checkAlarms, 1000);
});

onUnmounted(() => {
  clearInterval(clockTimer);
  clearInterval(alarmCheckTimer);
  stopBeep();
  if (beepContext) {
    void beepContext.close().catch(() => {});
    beepContext = null;
  }
});

/* ---- Window Controls ---- */

const minimizeWindow = () => window.electronAPI && window.electronAPI.windowMinimize();
const hideWindow = () => window.electronAPI && window.electronAPI.windowHide();

/* ---- Alarm Management ---- */

const addAlarm = async (alarm: Alarm) => {
  alarms.value.push(alarm);
  await saveAlarms();
  isAdding.value = false;
};

const toggleAlarm = async (id: string) => {
  const alarm = alarms.value.find(a => a.id === id);
  if (alarm) {
    alarm.enabled = !alarm.enabled;
    await saveAlarms();
  }
};

const deleteAlarm = async (id: string) => {
  alarms.value = alarms.value.filter(a => a.id !== id);
  await saveAlarms();
};
</script>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.titlebar {
  height: 38px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
  background: var(--panel-bg); /* #11 fix: was hardcoded #ffffff */
  -webkit-app-region: drag;
  user-select: none;
  border-bottom: 1px solid var(--border-color);
}

.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
}

.titlebar-controls {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 12px;
}

.control-btn {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: transform 0.2s, opacity 0.2s;
  opacity: 0.8;
}

.control-btn:hover {
  transform: scale(1.1);
  opacity: 1;
}

.btn-close { background-color: #ff5f56; }
.btn-minimize { background-color: #ffbd2e; }

.main-content {
  flex: 1;
  padding: 24px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.clock-display {
  font-family: 'JetBrains Mono', monospace;
  font-size: 3.5rem;
  font-weight: 600;
  text-align: center;
  margin-bottom: 30px;
  color: var(--accent-color);
  text-shadow: none;
  letter-spacing: 2px;
}

.alarms-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
  flex: 1;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-top: 20px;
}

.actions-area {
  display: flex;
  justify-content: center;
  margin-top: auto;
}

.add-btn {
  padding: 12px 32px;
  background: var(--accent-color);
  border: 1px solid var(--border-color);
  border-radius: 100px;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 1rem;
  font-weight: 500;
}

.add-btn:hover {
  background: #2563eb;
  border-color: #2563eb;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
  transform: translateY(-2px);
}
</style>
