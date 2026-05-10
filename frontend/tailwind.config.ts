import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#f5f1ea",
        ink: "#161616",
        accent: {
          DEFAULT: "#0f766e",
          soft: "#d7f3ee",
          deep: "#0a4b47",
        },
        sand: "#efe4d4",
        rust: "#b45309",
        slate: "#465060",
      },
      boxShadow: {
        panel: "0 24px 80px rgba(24, 33, 41, 0.12)",
      },
      backgroundImage: {
        "mesh-light":
          "radial-gradient(circle at top left, rgba(15,118,110,0.18), transparent 28%), radial-gradient(circle at 85% 18%, rgba(180,83,9,0.16), transparent 24%), linear-gradient(180deg, #f9f6f1 0%, #efe8df 100%)",
      },
      fontFamily: {
        sans: ["Avenir Next", "Segoe UI", "Helvetica Neue", "Arial", "sans-serif"],
        display: ["Iowan Old Style", "Palatino", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
