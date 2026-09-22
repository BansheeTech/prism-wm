# @prism-wm/react

React adapter for [Prism Window Manager](https://www.banshee.pro): draggable,
resizable windows with focus and z-index handling, snapping, and dialogs.

```bash
npm install @prism-wm/react
```

The stylesheets come with it; import the one you want, then mount the
manager once and tell it how to turn an app id into a component:

```ts
import "@prism-wm/styles/prism.css";
```

```tsx
<PrismWindowManager store={store} resolveComponent={resolveComponent} />
```

```ts
import { createWindowManager } from "@prism-wm/react";

const store = createWindowManager({ resolveApp: (id) => APPS[id] });
store.openWindow("notepad", { title: "Untitled" });
```

Windows are addressed by id because they are opened from places that know
nothing about each other: a taskbar, a start menu, a desktop icon.

Dialogs are the opposite case, so they are written where they are used:

```tsx
<PrismDialog visible={confirming} onVisibleChange={setConfirming}
             title="Delete file?" okText="Delete" onOk={del}>
  <p>{file.name} will be permanently removed.</p>
</PrismDialog>
```

The children stay in the parent's tree and in its scope. A dialog is still a
window underneath, so it drags, stacks and animates like everything else.

## License

AGPL-3.0-or-later. See the `LICENSE` file in this package.

**Deploying this in a web app?** The AGPL's section 13 requires you to offer
your users the source of *your* application, not just of Prism, through a
visible link from the running app. The commercial license below is the way out
if that does not suit your project.

A commercial license is available for parties who cannot comply with the AGPL.
Banshee Technologies S.L. is the sole copyright holder and can dual-license;
contact us through [banshee.pro](https://www.banshee.pro).
