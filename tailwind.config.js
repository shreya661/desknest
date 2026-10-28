/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-elevated": "var(--color-surface-elevated)",
        "surface-hover": "var(--color-surface-hover)",
        border: "var(--color-border)",
        "border-focus": "var(--color-border-focus)",
        primary: {
          DEFAULT: "var(--color-primary)",
          hover: "var(--color-primary-hover)",
          foreground: "var(--color-primary-fg)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-fg)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          foreground: "var(--color-danger-fg)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          foreground: "var(--color-warning-fg)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          foreground: "var(--color-success-fg)",
        },
      },
      borderRadius: {
        widget: "14px",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "Roboto",
          '"Helvetica Neue"',
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        widget: "0 10px 30px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--color-border)",
        card: "0 2px 8px -2px rgba(0, 0, 0, 0.1), 0 0 0 1px var(--color-border)",
      },
    },
  },
  plugins: [],
}
