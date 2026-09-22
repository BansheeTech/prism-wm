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
<!-- The empty typed script block is required or svelte2tsx emits no declaration meow. -->
<script lang="ts">
  // Shown when the body has nothing to render:
</script>

<div class="pwm-window-loading">
  <svg class="pwm-loading-icon" viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
    <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3c4.97 0 9 4.03 9 9" />
  </svg>
</div>
