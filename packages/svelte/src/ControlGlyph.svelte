<!--
  Prism Window Manager (@prism-wm), Svelte adapter
  Copyright (C) 2023-2026 Banshee Technologies S.L.
  Authors: Claudio González, Néstor González
  https://www.banshee.pro/

  Extracted from HomeDock OS: https://github.com/BansheeTech/HomeDockOS

  @license AGPL-3.0-or-later

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program. If not, see <https://www.gnu.org/licenses/>.

  SPDX-License-Identifier: AGPL-3.0-or-later
-->
<script lang="ts">
  export let kind: "window" | "minimize" | "maximize" | "restore" | "close";
</script>

<svg class="pwm-fallback-icon" data-glyph={kind} viewBox="0 0 24 24" fill={kind === "window" ? "currentColor" : "none"} stroke={kind === "window" ? "none" : "currentColor"} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if kind === "window"}
    <path d="M21.53 5.15a.99.99 0 0 0-.97-.04l-10 5a1 1 0 0 0-.55.89v10a1 1 0 0 0 1 1c.15 0 .31-.04.45-.11l10-5a1 1 0 0 0 .55-.89V6c0-.35-.18-.67-.47-.85ZM20 15.38l-8 4v-7.76l8-4z" />
    <path d="m16.55 3.11l-10 5A1 1 0 0 0 6 9v10h2V9.62l9.45-4.72l-.89-1.79Z" />
    <path d="m12.55 1.11l-10 5A1 1 0 0 0 2 7v10h2V7.62l9.45-4.73l-.89-1.79Z" />
  {:else if kind === "minimize"}
    <path d="M5 12h14" />
  {:else if kind === "maximize"}
    <rect x="5" y="5" width="14" height="14" rx="1.5" />
    <path d="M5 9h14" />
  {:else if kind === "restore"}
    <path d="M8.5 8.5V6.5A1.5 1.5 0 0 1 10 5h7.5A1.5 1.5 0 0 1 19 6.5V14a1.5 1.5 0 0 1-1.5 1.5h-2" />
    <rect x="5" y="8.5" width="10.5" height="10.5" rx="1.5" />
    <path d="M5 12h10.5" />
  {:else}
    <path d="M6 6l12 12M18 6L6 18" />
  {/if}
</svg>
