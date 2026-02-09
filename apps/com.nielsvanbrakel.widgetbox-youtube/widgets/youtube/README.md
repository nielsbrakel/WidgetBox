# YouTube Widget

**Directory**: `widgets/youtube`

Embeds a YouTube video or livestream directly in the dashboard.

## Features
*   **Playback**: Support for single Videos or Playlists.
*   **Controls**: Autoplay, Loop, and Mute options.
*   **UI**: Optional player controls.
*   **Sizing**: Multiple aspect ratios including Portrait mode.

## Settings (`widget.compose.json`)

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `videoId` | Text | - | YouTube Video ID. |
| `playlistId` | Text | - | Optional Playlist ID. |
| `autoplay` | Checkbox | `true` | Auto-start video. |
| `mute` | Checkbox | `false` | Start muted (often required for Autoplay). |
| `controls` | Checkbox | `false` | Show YouTube player controls. |
| `loop` | Checkbox | `false` | Loop video/playlist. |
| `start` | Number | `0` | Start time offset (seconds). |
| `aspectRatio` | Dropdown | `16:9` | **Standard**: 1:1, 4:3, 16:9, 9:16 (Portrait), 21:9. |

## Development Notes
*   **Standards**: Implements the **Aspect Ratio** standard.
*   **API**: Uses YouTube Embed API. Note that autoplay policies on some browsers/devices require the video to be muted.
