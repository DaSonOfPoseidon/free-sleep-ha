# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Free Sleep is a Home Assistant custom integration for controlling and monitoring an Eight Sleep Pod running Free Sleep firmware. It communicates with the Pod's local HTTP API (no cloud dependencies) and provides climate control, power switches, biometric sensors, presence detection, and a custom Lovelace dashboard card.

- **Domain**: `free_sleep`
- **HA Requirement**: 2024.1.0+
- **IoT Class**: Local Polling
- **Zero external dependencies** — uses only Home Assistant built-ins (`aiohttp`, `voluptuous`)

## Development

There is no build system, test suite, or linting configured. The integration is deployed as source files into Home Assistant's `custom_components/` directory or installed via HACS.

To test changes, copy or symlink `custom_components/free_sleep/` into a Home Assistant dev instance and restart.

## Architecture

### Data Flow

```
HA Core → FreeSleepCoordinator (polls Pod API every 30s)
  → /api/deviceStatus        (temperature, power, alarm state per side)
  → /api/settings             (user names for bed sides)
  → /api/metrics/presence     (bed occupancy per side)
  → /api/metrics/vitals/summary (HR, HRV, breathing per side)
  ↓
Platform entities read from coordinator.data
  → climate.py   (temperature control, left/right)
  → switch.py    (power on/off, left/right)
  → sensor.py    (biometrics + bed temp, 4 per side)
  → binary_sensor.py (presence + alarm vibrating, 2 per side)
```

### Key Patterns

- **DataUpdateCoordinator pattern**: `coordinator.py` is the central data hub. All platform entities subscribe to it rather than making their own API calls.
- **Best-effort polling**: Device status fetch is mandatory; presence and vitals failures are logged but don't crash the coordinator.
- **Session pooling**: A single `aiohttp.ClientSession` is created on demand and reused across all requests, with explicit cleanup on HA shutdown.
- **Dynamic entity naming**: Friendly names are pulled from Pod settings (side user names like "Alice"), falling back to generic names.
- **POST to control**: Climate and switch entities write state changes via POST to `/api/deviceStatus` with side-specific payloads.

### Frontend Card

`frontend/free-sleep-card.js` is a self-contained vanilla JS Web Component (no framework). It uses shadow DOM, CSS Grid, and a frosted-glass design with temperature-based color gradients. It includes a built-in Lovelace config editor.

## Pod API Reference

| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/api/deviceStatus` | GET, POST | Temperature, power, alarm state per side |
| `/api/settings` | GET | Side names and user info |
| `/api/metrics/vitals/summary?side={side}` | GET | Heart rate, HRV, breathing rate |
| `/api/metrics/presence?side={side}` | GET | Bed occupancy detection |

Default Pod port: **3000**. Temperature range: **55–110°F**.
