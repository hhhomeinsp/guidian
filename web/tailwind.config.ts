import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        body: ["Georgia", "serif"],
        mono: ["Courier New", "Courier", "monospace"],
      },
      colors: {
        // shadcn CSS-var tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Guidian brand palette
        navy: {
          DEFAULT: "#162D4A",
          deep: "#0D1C2E",
          mid: "#1E3D5C",
        },
        amber: {
          DEFAULT: "#C98A2A",
          light: "#E4A94A",
          dim: "#8B5E1A",
        },
        teal: {
          DEFAULT: "#0E7C7B",
          light: "#13A09E",
          dim: "#095857",
        },
        ink: "#0D1C2B",
        slate: "#3D5A73",
        steel: "#6B8499",
        mist: "#B8CADA",
        cloud: "#DDE8F0",
        fog: "#EDF2F6",
        cream: "#FAF7F2",
        // Journey stage colors
        stage: {
          "pre-college": "#4A80B5",
          vocational: "#0E7C7B",
          college: "#3D5A73",
          certif: "#4A7C6F",
          licensure: "#162D4A",
          ce: "#C98A2A",
        },
        // Semantic
        success: {
          DEFAULT: "#2A7A4A",
          bg: "#EAF5EE",
        },
        warning: {
          DEFAULT: "#B56A10",
          bg: "#FEF3E2",
        },
        error: {
          DEFAULT: "#A53030",
          bg: "#FDEAEA",
        },
        info: {
          DEFAULT: "#1A5F8A",
          bg: "#E3EFF8",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "card": "0 2px 8px 0 rgba(22,45,74,0.08)",
        "card-hover": "0 4px 16px 0 rgba(22,45,74,0.14)",
        "amber": "0 4px 14px 0 rgba(201,138,42,0.35)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
