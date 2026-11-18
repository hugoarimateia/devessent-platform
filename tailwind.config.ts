import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/modules/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          sidebar: "var(--surface-sidebar)",
          muted: "var(--surface-muted)",
          elevated: "var(--surface-elevated)",
          border: "var(--surface-border)",
        },
        foreground: {
          DEFAULT: "var(--foreground)",
          muted: "var(--foreground-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          secondary: "var(--accent-secondary)",
          foreground: "var(--accent-foreground)",
          subtle: "var(--accent-subtle)",
        },
        tenant: {
          ink: "var(--t-ink)",
          fill: "var(--t-fill)",
          tint: "var(--t-tint)",
          border: "var(--t-border)",
          bg: "var(--t-badge-bg)",
          text: "var(--t-badge-text)",
        },
        status: {
          active: "var(--status-active)",
          suspended: "var(--status-suspended)",
          pending: "var(--status-pending)",
          info: "var(--status-info)",
        },
      },
      fontFamily: {
        display: [
          "var(--font-display)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        sans: [
          "var(--font-sans)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
        mono: [
          "var(--font-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        elevated: "var(--shadow-elevated)",
      },
    },
  },
  plugins: [],
};

export default config;
