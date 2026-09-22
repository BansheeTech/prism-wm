# @prism-wm/core

The framework-agnostic heart of [Prism Window Manager](https://www.banshee.pro):
the window list, the geometry, and the RAM manager. No DOM, no framework.

You normally install an adapter instead — `@prism-wm/vue`, `@prism-wm/react` or
`@prism-wm/svelte` — each of which depends on this. Reach for it directly only
to drive the store from outside a component, or to write your own adapter.

```bash
npm install @prism-wm/core
```

```ts
import { createWindowManager } from "@prism-wm/core";

const store = new WindowManagerStore({ resolveApp: (id) => APPS[id] });
store.openWindow("notepad", { title: "Untitled" });
```

Every mutation replaces the state object, so `subscribe()` pairs with
`useSyncExternalStore`, a Svelte store or a Vue `shallowRef` without a selector
library.

## License

AGPL-3.0-or-later. See the `LICENSE` file in this package.

**Deploying this in a web app?** The AGPL's section 13 requires you to offer
your users the source of *your* application, not just of Prism, through a
visible link from the running app. The commercial license below is the way out
if that does not suit your project.

A commercial license is available for parties who cannot comply with the AGPL.
Banshee Technologies S.L. is the sole copyright holder and can dual-license;
contact us through [banshee.pro](https://www.banshee.pro).
