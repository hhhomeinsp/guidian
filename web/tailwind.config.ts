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
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["SF Mono", "Fira Code", "monospace"],
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
        // Guidian brand palette — Apple-inspired
        navy: {
          DEFAULT: "#1D1D1F",   // Apple near-black
          deep: "#000000",
          mid: "#2D2D2F",
          brand: "#162D4A",     // Original brand navy — logo/hero only
        },
        amber: {
          DEFAULT: "#C98A2A",
          light: "#E4A94A",
          dim: "#8B5E1A",
        },
        blue: {
          DEFAULT: "#0071E3",   // Apple blue — primary CTA
          hover: "#0077ED",
          light: "#E8F0FE",
        },
        teal: {
          DEFAULT: "#0E7C7B",
          light: "#13A09E",
          dim: "#095857",
        },
        ink: "#1D1D1F",
        slate: "#3D5A73",
        steel: "#6E6E73",
        mist: "#AEAEB2",
        cloud: "#D2D2D7",
        fog: "#F5F5F7",
        cream: "#F5F5F7",
        fill: "#F5F5F7",
        surface: "#FFFFFF",
        separator: "#D2D2D7",
        // Journey stage colors — Apple palette
        stage: {
          "pre-college": "#5E5CE6",
          vocational: "#30B0C7",
          college: "#0071E3",
          certif: "#34C759",
          licensure: "#1D1D1F",
          ce: "#FF9F0A",
        },
        // Semantic — Apple values
        success: {
          DEFAULT: "#34C759",
          bg: "#F0FFF4",
        },
        warning: {
          DEFAULT: "#FF9F0A",
          bg: "#FFF8EC",
        },
        error: {
          DEFAULT: "#FF3B30",
          bg: "#FFF2F1",
        },
        info: {
          DEFAULT: "#0071E3",
          bg: "#E8F0FE",
        },
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "10px",
        lg: "var(--radius)",
        xl: "18px",
        "2xl": "24px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        "card-hover": "0 12px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)",
        lg: "0 12px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06)",
        xl: "0 24px 60px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
