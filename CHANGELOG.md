# Changelog

All packages in this repository are versioned together.

## 1.2.0

### Added

- More `"playful"` motion. With `motion: "playful"`, windows pop in when opened, gather themselves before closing, overshoot slightly when maximized, restored or snapped, accelerate into their taskbar button when minimized and land with a small overshoot when restored, un-snap with a bounce, and settle with a light bounce after a resize. The snap preview pops in. Durations stay at 200 ms; `"standard"` and dialogs are unchanged.
- `.pwm-playful` on windows and on the snap preview while `motion` is `"playful"`, so hosts can style that mode.
- `WindowMotion.bounce(strength = 1)` takes a strength.
- `WindowMotionConfig.maxTurn`: its own limit for the 3D turn (`rotateY`), which used to share `maxLean` with the pitch (`rotateX`).
- `SNAP_VERTICAL_THRESHOLD` (2 px) and a sixth `verticalThreshold` parameter on `detectSnapEdge`.

### Fixed

- A window that closes or minimizes now fades out its active border and glow over the exit animation, instead of losing them the instant focus moves on.
- Dragging a snapped window by the upper part of its title bar no longer maximizes it or drops it into a quarter. The top edge and the bottom corners now need the cursor at the edge itself, past `SNAP_VERTICAL_THRESHOLD`; the side edges keep their 20 px.

### Changed

- The playful drag wobble is calmer: the tilt (`maxTilt`) is 1.625° instead of 2.5°, the 3D turn (`maxTurn`) 3.25° instead of 5°, and `PWM_WOBBLE_SPRING` damping is 26 instead of 18, so the window no longer swings past rest when you stop.

## 1.1.0

### Breaking

- `detectSnapEdge` now takes `(cursorX, cursorY, viewport, taskbarHeight = 0, threshold = 20)` instead of `(cursorX, viewportWidth, threshold)`.
- `prefersReducedMotion` is no longer exported, and Prism no longer checks `prefers-reduced-motion` anywhere. Animations behave the same whatever the system preference; use `motion` to turn the playful effects off.

### Added

- Minimize to the taskbar: pass `getMinimizeTarget(id)` to `createWindowManager` and return the rect of the window's taskbar button (a `DOMRect` works as is). The window shrinks into that rect when minimized and grows back out of it when restored. Returning `null` keeps the previous animation.
- Full snap: dragging to the top edge maximizes, and dragging to a corner snaps to a quarter of the screen, above the taskbar. `SnapSide` gains `"top"`, `"top-left"`, `"top-right"`, `"bottom-left"` and `"bottom-right"`. Quarters un-snap with the same morph as halves.
- Dragging a maximized window by its title bar restores it to its previous size under the cursor.
- `motion: "standard" | "playful"`, as a `createWindowManager` option and a `<PrismWindowManager>` prop (the prop wins). `"playful"` tilts the window in 3D while it is dragged, settles it with a spring on release, and gives a small scale bounce when it lands in a snap zone. Defaults to `"standard"`. Switch it at runtime with the prop or `store.setMotion()`.
- Core exports: `WindowMotion`, `stepSpring`, `DEFAULT_WINDOW_MOTION`, `PWM_WOBBLE_SPRING`, `PWM_BOUNCE_SPRING`, `computeSnapPreviewStyle`, `computeWindowBounds`, `computeMinimizeTransform`, and the types `PrismMotion`, `MinimizeTarget`, `SpringConfig`, `SpringState`, `WindowMotionConfig` and `WindowMotionPose`.
- Store: `getMinimizeTarget(id)`, `motion`, `setMotion()`, and `motion` in `WindowManagerState`.

### Changed

- `.pwm-window` no longer transitions `transform` or `transform-origin`.

## 1.0.0

First public release, extracted from [HomeDock OS](https://github.com/BansheeTech/HomeDockOS).

- `@prism-wm/core`: window store, geometry and RAM manager. No DOM, no framework.
- `@prism-wm/styles`: `prism-structure.css` and `prism-theme.css`, themeable through `--pwm-*` custom properties.
- `@prism-wm/vue`: Vue 3 adapter.
- `@prism-wm/react`: React 18 and 19 adapter.
- `@prism-wm/svelte`: Svelte adapter.
