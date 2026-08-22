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
        DEFAULT: "4px",
        panel: "14px",
        card: "10px",
        btn: "999px",
      },
      keyframes: {
        "step-dot-wave": {
          "0%, 100%": {
            opacity: "var(--dot-o, 0.8)",
            transform: "scale(var(--dot-s, 1))",
          },
          "50%": {
            opacity: "calc(var(--dot-o, 0.8) * 0.32)",
            transform: "scale(calc(var(--dot-s, 1) * 0.62))",
          },
        },
        "step-orbit": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "step-orbit-reverse": {
          from: { transform: "rotate(360deg)" },
          to: { transform: "rotate(0deg)" },
        },
        "step-breathe": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.05)" },
        },
      },
      animation: {
        "step-dot-wave": "step-dot-wave 2.8s ease-in-out infinite",
        "step-orbit": "step-orbit 24s linear infinite",
        "step-orbit-reverse": "step-orbit-reverse 26s linear infinite",
        "step-breathe": "step-breathe 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
