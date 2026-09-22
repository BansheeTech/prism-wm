# Contributing to Prism

Prism is an open project and contributions are welcome — bug reports, docs,
tutorials, feature ideas, or code. Here is how it works.

## Bug reports

Check you are on the latest release first, then search the [existing
issues](https://github.com/BansheeTechnologies/prism-wm/issues) in case someone
got there before you. If nothing matches, open one and tell us how to reproduce
it. The easier it is for us to recreate, the faster it gets fixed.

## Feature requests

If you find yourself wishing Prism did something it doesn't, you are probably not
the only one. Search the issues, and open one if it isn't there.

## Code and documentation

For anything beyond a small fix, open an issue to talk through the approach
before you write it. There are usually several ways to solve a problem, and it is
better to agree on one than to spend a weekend on a branch that turns out not to
fit. Issues tagged `good first issue` are a decent place to start.

### Getting set up

```bash
pnpm install
pnpm build        # builds packages/* only
pnpm typecheck
pnpm test
```

### How the monorepo fits together

| Package            | What it is                                                               |
| ------------------ | ------------------------------------------------------------------------ |
| `@prism-wm/core`   | Framework-agnostic state store, geometry, RAM manager. No DOM rendering. |
| `@prism-wm/react`  | React adapter                                                            |
| `@prism-wm/vue`    | Vue 3 adapter                                                            |
| `@prism-wm/svelte` | Svelte adapter                                                           |
| `@prism-wm/styles` | Base stylesheet, themed via `--pwm-*` custom properties                  |

Behaviour belongs in `core` wherever it can live there, and the adapters stay
thin. If you find yourself writing the same logic twice in two adapters, that is
the signal it belongs in `core`.

Two house rules worth knowing before you start:

- **No runtime dependencies.** Prism ships with zero, in every package, and we
  intend to keep it that way — it is a big part of why people can drop it into
  anything. Build and test tooling is fine; raise it in an issue first.
- **Glyphs are hand-drawn inline SVG.** No icon sets, no icon fonts. Same reason.

### Sending the pull request

- Branch from `main`.
- Add tests for behaviour changes. `core` and `react` have the fullest suites —
  follow their patterns.
- Run `pnpm typecheck && pnpm test` before pushing.
- One concern per PR.
- New files get the licence header from
  [`scripts/license-header.txt`](./scripts/license-header.txt), copied verbatim.
- Tell us what breaks if the change is wrong. That is the part reviewers need
  most.

## Contributor licence

Prism is released under the AGPL and is also offered under commercial terms to
people who cannot comply with it. That arrangement only works if we can license
the whole codebase both ways, so contributions come in under MIT rather than the
AGPL the project goes out under. Inbound MIT, outbound AGPL — it is a common
setup for dual-licensed projects.

By submitting a contribution, you agree that all of your present and past
contributions to Prism are licensed to Banshee Technologies S.L. under the MIT
license (below), and do not require us to include your copyright notice. You keep
the copyright in your work; this is a licence, not an assignment, and your
authorship stays in the git history either way. If you would also like to be on
the contributor list, just say so in your pull request.

Two practical notes. Please only send us work that is yours to license — code or
assets lifted from elsewhere put us in a position we cannot license our way out
of, so if part of a contribution came from another project, flag it in the PR and
we will figure out whether it can be included. And if you are contributing on
company time and are not sure your contract lets you grant the above, check
before you send it, or email `legal@banshee.pro` and we will sort it out.

```
Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall
be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```
