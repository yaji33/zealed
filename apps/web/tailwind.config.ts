import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "#0a0a0a",
        ink: "#f5f3ee",
        muted: "rgba(245, 243, 238, 0.6)",
        line: "rgba(245, 243, 238, 0.14)",
        ember: "#ff5a33",
        mint: "#b8f5e6",
        elevated: "#101114",
        soft: "#16171c",
        accent: "#d4a84b",
        public: "#5b9fd4",
        private: "#d4a84b",
        danger: "#d87b6a",
        ok: "#6fbf8a",
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
        outfit: ['"Outfit"', "system-ui", "sans-serif"],
        "dm-sans": ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        fraunces: ["var(--font-fraunces)", "serif"],
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "4image.pngpx",
        panel: "14px",
        card: "10px",
        btn: "999px",
      },
    },
  },
  plugins: [],
};

export default config;
