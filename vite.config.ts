import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // Nunca carregar automaticamente .env.local (XAMPP/dev local) em builds Cloudflare Workers.
  // Variáveis públicas entram explicitamente pelo script cf-staging / CI; segredos entram em runtime via Cloudflare Secrets.
  envDir: false,
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
