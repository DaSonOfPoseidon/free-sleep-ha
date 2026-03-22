# Free Sleep for Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-2024.1%2B-41BDF5.svg)](https://www.home-assistant.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A [Home Assistant](https://www.home-assistant.io) custom integration for Eight Sleep Pod mattress covers running [free-sleep](https://github.com/throwaway31265/free-sleep) firmware. Provides fully local climate control, biometric sensors, presence detection, and a custom Lovelace dashboard card — no cloud, no accounts, no API keys.

> **Compatibility**: This integration works with any [free-sleep](https://github.com/throwaway31265/free-sleep) firmware fork that preserves the standard local API on port 3000. It is not locked to a specific fork or version.

## Features

- **Climate control** — target temperature 55–110°F per side
- **Power switch** — on/off per side
- **Biometric sensors** — heart rate, HRV, breathing rate per side
- **Bed temperature** — current mattress temperature per side
- **Presence detection** — bed occupancy per side
- **Alarm status** — vibration alert active per side
- **Custom Lovelace card** — frosted-glass design with temperature-based color gradients
- **100% local** — zero cloud dependencies

## Prerequisites

- Eight Sleep Pod with [free-sleep](https://github.com/DaSonOfPoseidon/SoundSleeper) firmware installed and running
- Pod accessible on your local network (note its IP address)
- [Home Assistant](https://www.home-assistant.io) 2024.1.0 or newer

## Installation

### HACS (Recommended)

1. Open [HACS](https://hacs.xyz) in your Home Assistant instance
2. Click **Integrations**
3. Click the three-dot menu in the top right → **Custom repositories**
4. Enter the repository URL: `https://github.com/DaSonOfPoseidon/free-sleep-ha`
5. Select **Integration** as the category and click **Add**
6. Search for **Free Sleep** in HACS and click **Download**
7. Restart Home Assistant

### Manual

1. Download the `custom_components/free_sleep` folder from this repository
2. Copy the entire `free_sleep` folder into your Home Assistant `config/custom_components/` directory
3. Restart Home Assistant

## Configuration

1. Go to **Settings → Devices & Services → Add Integration**
2. Search for **Free Sleep**
3. Enter the IP address of your Pod (e.g., `192.168.1.100`)
4. The integration validates the connection and creates all entities automatically

No authentication is required — the Pod API is local HTTP only.

## Entities

For a two-sided bed, the integration creates **16 entities**:

| Entity | Type | Per Side | Description |
|--------|------|----------|-------------|
| Climate | `climate` | Yes | Temperature control (55–110°F) |
| Power | `switch` | Yes | Turn side on/off |
| Heart Rate | `sensor` | Yes | Average heart rate (bpm) |
| HRV | `sensor` | Yes | Heart rate variability (ms) |
| Breathing Rate | `sensor` | Yes | Breaths per minute |
| Bed Temperature | `sensor` | Yes | Current mattress temperature |
| Bed Presence | `binary_sensor` | Yes | In bed / Empty |
| Alarm Vibrating | `binary_sensor` | Yes | Alarm vibration active |

Entity names are personalized from Pod settings (e.g., "Alice's Heart Rate") when available, falling back to "Left Side" / "Right Side".

## Custom Lovelace Card

The integration includes a custom card with temperature controls, presence indicators, and biometric readouts.

### Setup

1. Go to **Settings → Dashboards → Resources**
2. Add a new resource:
   - **URL**: `/local/community/free_sleep/frontend/free-sleep-card.js` (HACS) or `/local/free-sleep-card.js` (manual — copy the JS file to your `www/` directory)
   - **Type**: JavaScript Module
3. Add the card to your dashboard via the UI card picker (search "Free Sleep") or in YAML:

```yaml
type: custom:free-sleep-card
left_climate: climate.free_sleep_pod_left_side
right_climate: climate.free_sleep_pod_right_side
left_presence: binary_sensor.free_sleep_pod_left_bed_presence
right_presence: binary_sensor.free_sleep_pod_right_bed_presence
left_heart_rate: sensor.free_sleep_pod_left_heart_rate
right_heart_rate: sensor.free_sleep_pod_right_heart_rate
left_breathing_rate: sensor.free_sleep_pod_left_breathing_rate
right_breathing_rate: sensor.free_sleep_pod_right_breathing_rate
show_vitals: true
```

Adjust entity IDs to match your installation (names depend on your Pod's side configuration).

## Network Requirements

The Pod API runs on port **3000**. Ensure your Home Assistant instance can reach the Pod IP on that port. No internet access is required.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot connect during setup | Verify the Pod IP is correct and reachable. Test with `curl http://<POD_IP>:3000/api/deviceStatus`. Ensure [free-sleep](https://github.com/DaSonOfPoseidon/SoundSleeper) firmware is running. |
| Sensors show "Unknown" | Vitals and presence data require someone to be in bed. Sensors populate once occupancy is detected. |
| Entities named "Left/Right" instead of person names | Side names come from Pod settings. Configure names in the [free-sleep](https://github.com/DaSonOfPoseidon/SoundSleeper) firmware settings interface. |

## Credits

This integration is built for the [free-sleep](https://github.com/throwaway31265/free-sleep) open-source firmware, which enables local control of Eight Sleep Pod mattress covers without cloud dependencies or subscriptions.

## License

This project is licensed under the [MIT License](LICENSE).
