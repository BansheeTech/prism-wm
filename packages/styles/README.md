# @prism-wm/styles

Stylesheets for [Prism Window Manager](https://www.banshee.pro), split so you
can take only what you need.

```bash
npm install @prism-wm/styles
```

```ts
import "@prism-wm/styles/prism.css";            // structure + the default dark theme
import "@prism-wm/styles/prism-structure.css";  // layout, geometry and motion only
import "@prism-wm/styles/prism-theme.css";      // colour only, via --pwm-* properties
```

Import `prism.css` for a working look out of the box, and override the `--pwm-*`
custom properties to taste.

Apps that already own a design system import `prism-structure.css` alone and
pass their own class names through the adapter's `classes` prop, so nothing in
the package fights their styles.

## License

AGPL-3.0-or-later. See the `LICENSE` file in this package.

**Deploying this in a web app?** The AGPL's section 13 requires you to offer
your users the source of *your* application, not just of Prism, through a
visible link from the running app. The commercial license below is the way out
if that does not suit your project.

A commercial license is available for parties who cannot comply with the AGPL.
Banshee Technologies S.L. is the sole copyright holder and can dual-license;
contact us through [banshee.pro](https://www.banshee.pro).
