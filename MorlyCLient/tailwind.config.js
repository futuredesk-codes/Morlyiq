/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0B3B8C",
        navyDeep: "#082C6B",
        blue: {
          DEFAULT: "#2F6FED",
          soft: "#E8EFFD",
          soft2: "#F1F5FE",
        },
        blueSoft: "#E8EFFD",
        blueSoft2: "#F1F5FE",
        surface: "#FFFFFF",
        borderStrong: "#C6D3EE",
        textMute: "#5E6C87",
        textFaint: "#8C97AE",
        successSoft: "#E4F6ED",
        warnSoft: "#FCF0DD",
        dangerSoft: "#FBE7E7",
        brand: {
          navy: "#0B3B8C",
          navyDeep: "#082C6B",
          blue: "#2F6FED",
          blueSoft: "#E8EFFD",
          blueSoft2: "#F1F5FE",
          bg: "#F4F7FD",
          surface: "#FFFFFF",
          border: "#DFE6F5",
          borderStrong: "#C6D3EE",
          text: "#0F1B33",
          textMute: "#5E6C87",
          textFaint: "#8C97AE",
          success: "#1E8E5A",
          successSoft: "#E4F6ED",
          warn: "#B8791F",
          warnSoft: "#FCF0DD",
          danger: "#C23B3B",
          dangerSoft: "#FBE7E7",
          white: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,59,140,0.04)",
        modal: "0 30px 80px rgba(11,27,51,0.35)",
        popover: "0 12px 30px rgba(11,27,51,0.18)",
        toast: "0 10px 30px rgba(11,59,140,0.25)",
      },
      animation: {
        spin: "spin 1s linear infinite",
      },
    },
  },
  plugins: [],
};
