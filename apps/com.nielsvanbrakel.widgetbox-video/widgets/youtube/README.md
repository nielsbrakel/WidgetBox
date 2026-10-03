# Video widget (`youtube`)

**Directory**: `widgets/youtube`

Embeds a YouTube video, livestream or playlist through `youtube-nocookie.com`. The widget id stays `youtube`; the visible name is "Video", because YouTube's branding rules do not allow "YouTube" as an app or widget name.

## Behaviour

- Both source settings accept a bare ID or a link: `watch?v=`, `youtu.be/`, `/shorts/`, `/live/`, `/embed/`, `/playlist?list=` and `&list=` links. A `t=` timestamp in a link is used as the start time when "Start at" is 0.
- With no source the widget shows an empty state; with an unrecognised value it shows a "Link not recognized" state instead of YouTube's own error page.
- Autoplay always mutes (browser autoplay rule). With autoplay off, the widget shows the video thumbnail and a play button and only loads the YouTube player after a tap.
- Loop on a single video adds `playlist=<videoId>`, which YouTube needs for looping.
- When the dashboard is hidden the player is paused through the IFrame API (`enablejsapi=1`); autoplaying videos resume when it becomes visible again.
- Height is the selected aspect ratio, passed as a percentage to `Homey.ready()` / `Homey.setHeight()`.
- iOS: the Homey app cannot play embedded YouTube videos, so the widget shows a translated notice. Test it in the sandbox with the "Simulate iOS" debug scenario.

## Settings

| ID | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `videoId` | Text | *(empty)* | YouTube video link or 11-character ID. |
| `playlistId` | Text | *(empty)* | Optional playlist link or ID. With a video set, the playlist starts at that video. |
| `aspectRatio` | Dropdown | `16:9` | 1:1, 4:3, 16:9, 9:16, 21:9 or 3:1. |
| `autoplay` | Checkbox | `true` | Start playing muted when the dashboard opens. |
| `mute` | Checkbox | `false` | Start muted (always on with autoplay). |
| `loop` | Checkbox | `false` | Repeat the video or playlist. |
| `controls` | Checkbox | `false` | Show YouTube player controls. |
| `start` | Number | `0` | Start offset in seconds. |
