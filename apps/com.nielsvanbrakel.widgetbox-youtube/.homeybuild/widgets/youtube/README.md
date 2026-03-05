# YouTube Widget

**Directory**: `widgets/youtube`

Embeds a YouTube video or livestream directly in the dashboard.

> **⚠️ iOS Notice:** This widget does not work on iOS dashboards due to a limitation of the Homey app. It does work on Android and web devices.

## Features
*   **Playback**: Support for single Videos or Playlists.
*   **Controls**: Autoplay, Loop, and Mute options.
*   **UI**: Optional player controls.
*   **Sizing**: Multiple aspect ratios including Portrait mode.
*   **Wake Lock**: Optional "Keep Screen On" to prevent device sleep.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `autoplay` | Checkbox | `true` | Auto-start video. |
| `mute` | Checkbox | `false` | Start muted. |
| `controls` | Checkbox | `false` | Show YouTube player controls. |
| `loop` | Checkbox | `false` | Loop video/playlist. |
| `preventSleep` | Checkbox | `false` | Keep screen on while widget is active. |
| `start` | Number | `0` | Start time offset (seconds). |
| `aspectRatio` | Dropdown | `16:9` | 1:1, 4:3, 16:9, 9:16 (Portrait), 21:9, 3:1 (Panoramic). |

## Development Notes
*   **Standards**: Implements the **Aspect Ratio** standard.
*   **API**: Uses YouTube Embed API. Note that autoplay policies on some browsers/devices require the video to be muted.
*   **iOS**: Detects iOS via user agent and shows a fallback message. Testable in the sandbox via the "Simulate iOS" debug scenario.
