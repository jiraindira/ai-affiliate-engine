// @ts-check
import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";

import { remarkInlineProductCards } from "./src/lib/remark/remarkInlineProductCards.js";
import { wrapMethodologyCallout } from "./src/lib/remark/wrapMethodologyCallout.ts";

console.log("[astro.config] inline plugin is", typeof remarkInlineProductCards);
console.log("[astro.config] methodology plugin is", typeof wrapMethodologyCallout);

export default defineConfig({
  site: "http://localhost:4321",
  integrations: [tailwind()],
  markdown: {
    // wrappers first, injectors last
    remarkPlugins: [wrapMethodologyCallout, remarkInlineProductCards],
  },
});
