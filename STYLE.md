# Notes App Style Guide

This document describes the visual style used by the desktop Notes Widget Client so the Android app can match the same tone, theme behavior, and color system.

## Design Direction

The app should feel quiet, focused, and utility-first. It is a daily notes, timers, and sync tool, so the UI should prioritize readability, fast scanning, and calm controls over decoration.

Use a restrained interface with soft surfaces, clear hierarchy, modest spacing, and a single accent color family per theme. Avoid heavy gradients, decorative backgrounds, oversized hero elements, and card-heavy marketing layouts.

## Theme Behavior

The app supports both light and dark themes.

Default behavior:

- On launch, use the system theme.
- Provide a visible theme toggle in the top app bar/window header.
- The toggle label shows the active theme: `Light` or `Dark`.
- Switching themes should apply immediately without restarting.

Android recommendation:

- Use `AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM` or the platform equivalent for the default.
- Keep a manual in-app override if the desktop behavior is mirrored.
- Re-render rich text/Markdown surfaces after theme changes so code blocks, links, tables, and task checkboxes update correctly.

## Color Tokens

Use these role names instead of hard-coding colors in screens.

### Light Theme

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#f8f2e8` | App window/screen background |
| `panel` | `#fffaf2` | Primary panels, top app bar, large content sections |
| `panelAlt` | `#fcf6ec` | Text fields, editors, list backgrounds, preview surfaces |
| `card` | `#e6daee` | Secondary buttons and subtle framed controls |
| `accent` | `#7e4db8` | Important values, links, timer readout, active emphasis |
| `accentSoft` | `#b794da` | Selected list rows, accent button borders, text selection |
| `text` | `#2a2331` | Primary text |
| `muted` | `#74667e` | Secondary text, metadata, subtitles |
| `border` | `#dccfe2` | Field borders and quiet dividers |

### Dark Theme

| Token | Hex | Usage |
| --- | --- | --- |
| `background` | `#0c1118` | App window/screen background |
| `panel` | `#151c25` | Primary panels, top app bar, large content sections |
| `panelAlt` | `#1c2531` | Text fields, editors, list backgrounds, preview surfaces |
| `card` | `#273242` | Secondary buttons and subtle framed controls |
| `accent` | `#5bc2f9` | Important values, links, timer readout, active emphasis |
| `accentSoft` | `#26719e` | Selected list rows, accent button borders, text selection |
| `text` | `#eff6ff` | Primary text |
| `muted` | `#94a3b8` | Secondary text, metadata, subtitles |
| `border` | `#38434f` | Field borders and quiet dividers |

## Typography

Desktop fonts:

- Title: `Bahnschrift`, bold, 18sp equivalent.
- Body: `Segoe UI Variable`, regular, 14sp equivalent.
- Monospace editor/code: `Consolas`, regular, 13sp equivalent.

Android equivalents:

- Title: system sans, bold, 18sp.
- Body: system sans, regular, 14sp.
- Code/editor: platform monospace, 13sp.

Keep letter spacing at the platform default. Do not use negative tracking.

## Layout

Desktop structure:

- Header/top bar at the top.
- Tabs below header: `Notes`, `Timers`, `Sync`.
- Content area has a two-pane layout where useful:
  - Left pane for lists/actions.
  - Main pane for details/editor/preview.

Android structure:

- Use a top app bar with title, sync action, theme toggle, pin/close equivalents where relevant.
- Use bottom navigation or tabs for `Notes`, `Timers`, and `Sync`.
- On phones, convert the desktop two-pane layout into a list-detail flow.
- On tablets/foldables, preserve the two-pane layout.

Spacing:

- Outer screen padding: 18dp desktop equivalent; 16dp Android.
- Panel internal padding: 14-18dp.
- Control gaps: 8-12dp.
- List row padding: 10dp vertical and horizontal.

## Surfaces

Use three levels of surface:

- `background`: the overall app canvas.
- `panel`: grouped sections and app chrome.
- `panelAlt`: editable/readable surfaces such as lists, text fields, note editor, and Markdown preview.

Avoid nested cards. If a section already has a panel surface, controls inside it should be flat or lightly outlined, not wrapped in another decorative card.

## Borders And Shape

Desktop controls use rounded borders with a 16px corner arc and a 1.2px stroke.

Android recommendation:

- Use 8dp radius for panels and inputs.
- Use 8-12dp radius for buttons.
- Use a 1dp border for inputs and outlined buttons.
- Border color should be `border` for fields and `card` or `accentSoft` for buttons.

## Buttons

Default button:

- Text color: `text`.
- Border: `card`.
- Background: transparent or very subtle `card` tint.
- Padding: 8dp vertical, 12dp horizontal.

Accent button:

- Use for the primary local action in a section, such as `New`, `Add timer`, or `Save`.
- Border: `accentSoft`.
- Text remains `text`.
- Avoid large filled purple buttons unless Android accessibility testing shows the outlined treatment is too subtle.

Header buttons:

- Compact outlined controls.
- Same typography as body text.
- Actions currently used: `Sync`, `Light`/`Dark`, minimize, pin, close.

## Lists

List background: `panelAlt`.

Row style:

- 10dp padding.
- Title in `text`, bold.
- Metadata/subtitle in `muted`.
- Selected row background: `accentSoft`.
- Selected row text: `text`.

For notes:

- Pinned notes use a simple bullet prefix.
- The archive navigation row uses the same row style as note rows.

For timers:

- Timer name is primary text.
- Timer type (`timer` or `stopwatch`) is muted metadata.

## Text Fields And Editors

Text fields, note editor, and Markdown preview use `panelAlt` with a `border` outline.

Text input:

- Background: `panelAlt`.
- Text: `text`.
- Caret: `text`.
- Selection: `accentSoft`.
- Selected text: `text`.
- Padding: 8dp vertical, 10dp horizontal.

The note editor uses a monospace font and wraps text by words.

## Markdown Preview

Markdown preview should visually match the editor surface.

Preview colors:

- Body background: `panelAlt`.
- Body text and headings: `text`.
- Links: `accent`.
- Inline code and code blocks: `panel`.
- Blockquote border: `accentSoft`.
- Blockquote text: `muted`.
- Table borders and horizontal rules: `card` or `border`.
- Table headers: `panel`.
- Task checkbox glyphs/links: `accent`.

Preview spacing:

- Body font size: 14sp.
- Line height: about 1.6.
- Paragraph/list/table bottom margin: 14dp.
- Code block padding: 12dp.
- Code block radius: 12dp.

## Timers

Timer detail screen uses a calm panel with one strong focal value.

- Timer readout uses `accent`.
- Timer readout is large and bold: desktop uses 56sp equivalent.
- Timer metadata below the value uses muted/body styling.
- Empty state: show `00:00:00` and `No timer selected`.

Android recommendation:

- Use 44-56sp for the main timer value depending on screen width.
- Keep the timer value centered.
- Avoid colorful circular timer decoration unless it supports interaction or progress.

## Sync Screen

The Sync tab is form-oriented.

- Labels use `text`.
- Status value uses semantic color:
  - Success: green, desktop currently `#73dfa0`.
  - Warning/error: amber, desktop currently `#ffbe5c`.
  - Unknown/inactive: `muted`.
- The explanatory text lives in a `panelAlt` text area/surface.

Android recommendation:

- Use a simple settings-style form.
- Keep labels and fields aligned.
- Put `Save`, `Test`, and `Sync now` as compact actions, not oversized CTA blocks.

## Interaction Notes

- Scrolling should feel smooth.
- Theme switching should preserve selection, current note content, timer state, and sync status.
- Controls should not resize dramatically when text changes, especially the theme toggle and header actions.
- Disabled controls keep their layout position.

## Tone Of UI Text

Use short, plain English labels:

- `New`
- `Delete`
- `Edit`
- `Save`
- `Pin`
- `Unpin`
- `Archive`
- `Unarchive`
- `Add timer`
- `Add stopwatch`
- `Edit stopwatch`
- `Start / Pause`
- `Reset`
- `Sync now`

Status text should also stay concise:

- `Server is available`
- `Server: unknown`
- `Last sync: never`
- `No timer selected`
- `Select a note`
- `Modified: <date>`

