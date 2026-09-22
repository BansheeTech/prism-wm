<script lang="ts" setup>
import logo from "../../../assets/prism-wm-logo-128.webp";
</script>

<template>
  <div class="demo-about">
    <header class="demo-about-head">
      <img :src="logo" alt="" />
      <div>
        <h3>Prism Window Manager</h3>
        <p>A framework-agnostic desktop windowing system.</p>
      </div>
    </header>

    <section>
      <p class="demo-label">License</p>
      <p>
        Prism is free software, released under the <strong>GNU Affero General Public License v3.0 or later</strong>
        <code>AGPL-3.0-or-later</code>.
      </p>
      <ul class="demo-about-list">
        <li>Anyone who conveys Prism or a work derived from it, including over a network, has to release the corresponding source of that work under the AGPL.</li>
        <li>If users interact with your app over a network, you have to offer them the source of your program, not just of Prism (section 13). In practice: a visible link to your source from the running app.</li>
        <li>Splitting your changes into a separate adapter file does not avoid this: copyleft covers the derivative work as a whole.</li>
      </ul>
      <a class="demo-about-link" href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank" rel="noopener noreferrer">Read the full license</a>
    </section>

    <section class="demo-callout">
      <strong>You can't comply with the AGPL?</strong>
      <span>Dual-licensing is available.</span>
      <a href="mailto:hello@banshee.pro">hello@banshee.pro</a>
    </section>

    <dl class="demo-about-meta">
      <dt>Copyright</dt>
      <dd>© 2023-2026 Banshee Technologies S.L.</dd>
      <dt>Authors</dt>
      <dd><a href="https://www.linkedin.com/in/claudio-gonzalez-medina/" target="_blank" rel="noopener noreferrer">Claudio González</a>, <a href="https://www.linkedin.com/in/n%C3%A9stor-gonz%C3%A1lez-medina-63b245207/" target="_blank" rel="noopener noreferrer">Néstor González</a></dd>
      <dt>Origin</dt>
      <dd>Extracted from <a href="https://github.com/BansheeTech/HomeDockOS" target="_blank" rel="noopener noreferrer">HomeDock OS</a></dd>
      <dt>Website</dt>
      <dd><a href="https://www.banshee.pro" target="_blank" rel="noopener noreferrer">banshee.pro</a></dd>
    </dl>
  </div>
</template>
