# Code structure

Tempo is intentionally dependency-free, so the project is easy to understand and modify.

## Files

- `index.html` — page structure, accessible labels, and the monochrome visual styles.
- `app.js` — reader state, playback controls, WPM timing, looping, keyboard shortcuts, and text-to-speech.

## Common adjustments

- Change the default speed in the `value="300"` attributes for `#wpm` and `#speed` in `index.html`.
- Change the speed range by editing the `min`, `max`, and `step` attributes on those same controls.
- Update the sample passage in the `sample` button handler in `app.js`.
- Update colours in the CSS variables near the top of the `<style>` block in `index.html`.
- Change the displayed word chunk size in `speakChunk()` by editing `startIndex + 40`.

The JavaScript is organized into state, display helpers, playback controls, settings, event listeners, and optional WebMCP integration so each area can be updated independently.
