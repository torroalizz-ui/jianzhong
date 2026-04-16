# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

简钟 (JianZhong / "Simple Clock") — a minimalist desktop event reminder and alarm app built with Electron + Vue 3. The UI is entirely in Chinese (zh-CN). App ID: `com.kylin.alarm`.

## Build & Development Commands

```bash
# Full development mode (Vite hot-reload + Electron)
npm run electron:dev

# Renderer-only dev server (no Electron shell)
npm run dev

# Type-check and build for production
npm run build

# Build and package as installable (outputs to release/)
npm run electron:build

# Build then run Electron without hot-reload
npm run electron:dev:build

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint
npm run lint
```

## Architecture

This is an Electron app with two processes and a component-based Vue 3 renderer:

### Renderer Process (`src/`)
- **`App.vue`** — orchestrator component. Manages alarm state, audio playback (HTML5 `<audio>` + WebAudio beep fallback), clock display, and alarm checking loop.
- **`components/AlarmItem.vue`** — single alarm card with toggle, delete, stop actions.
- **`components/AlarmForm.vue`** — add-alarm form with time selectors, recurrence picker, ringtone file selection and preview.
- **`utils/alarm.ts`** — pure utility functions (date formatting, recurrence logic, ID generation). These are independently testable.
- **`main.ts`** — Vue app bootstrap (mounts to `#app`).
- **`env.d.ts`** — TypeScript declarations for the `Alarm` interface and `ElectronAPI` bridge type.
- **`styles/index.css`** — CSS custom properties (design tokens) and global base styles.

### Main Process (`electron/`)
- **`main.js`** — Electron main process. Creates a frameless transparent 420×640 BrowserWindow. Sets up system tray with context menu. Handles all IPC: alarm persistence via `electron-store`, ringtone file selection (native dialog), audio file access with extension validation, volume persistence, window controls, and OS notifications.
- **`preload.js`** — Exposes `window.electronAPI` via `contextBridge` with methods that map to `ipcRenderer.invoke()` calls.

### IPC Bridge Pattern
Renderer ↔ Main communication uses Electron's invoke/handle pattern. The renderer calls `window.electronAPI.*` methods (defined in `preload.js`), which map to `ipcMain.handle()` handlers in `main.js`. All available IPC channels are typed in `env.d.ts` under `ElectronAPI`.

### Data Persistence
Alarms are stored via `electron-store` (JSON file in user app data). The store schema has `alarms: Alarm[]` and `settings: { defaultRingtone, volume }`.

### Alarm Triggering Flow
1. `checkAlarms()` runs every 1s, compares current HH:MM to alarm times using `lastCheckedMinute` tracking (triggers once per minute transition)
2. All matching alarms in the same minute are processed: state updated, notifications sent, audio plays for the first match
3. Recurrence logic uses `chinese-workday` package for statutory workday/holiday detection
4. `lastTriggeredDate` prevents re-triggering on the same day
5. One-time alarms auto-disable after firing
6. Audio plays via `<audio>` element (custom ringtone or `public/sounds/default.wav`); falls back to WebAudio oscillator beep on failure
7. Auto-stops after `durationMinutes`

### Security
- IPC file access (`get-file-url`, `get-file-data-url`) restricts to audio file extensions only (mp3, wav, ogg, flac, aac, m4a, mp4)
- `save-alarms` validates alarm data structure before writing to store

### Key Design Decisions
- **Frameless + transparent window** — the rounded-corner UI is achieved via CSS `border-radius` on `#app` with Electron's `transparent: true` and `frame: false`
- **Titlebar is custom** — drag region handled via `-webkit-app-region: drag`; close button hides to tray instead of quitting
- **Path alias** `@` → `src/` configured in `vite.config.ts`
- **Vite base** set to `./` (relative) so built files work with Electron's `file://` protocol

### Utility Scripts (`scripts/`)
- `gen-default-wav.js` — generates the default 880Hz sine-wave alarm tone
- `gen-icon-png.js` — pure-Node PNG generator for the app icon (no Electron dependency)
- `gen-icon-from-svg.js` — alternative icon generator using Electron's `nativeImage`

### Packaging
electron-builder config is in `package.json` under `"build"`. Targets: Windows NSIS installer, Linux arm64 deb/AppImage. Output goes to `release/`.
