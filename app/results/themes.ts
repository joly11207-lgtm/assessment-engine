import type { PresentationThemeId } from "../../engine/capabilities";

export interface ResultTheme {
  id: PresentationThemeId;
  label: string;
  className: string;
  tokens: {
    background: string;
    surface: string;
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    muted: string;
    border: string;
    shadow: string;
  };
}

export const resultThemes = {
  editorial: {
    id: "editorial",
    label: "Editorial",
    className: "theme-editorial",
    tokens: {
      background: "#f2f3ef",
      surface: "#ffffff",
      primary: "#156f64",
      secondary: "#273c47",
      accent: "#f2a900",
      text: "#17231f",
      muted: "#66716c",
      border: "#daddd7",
      shadow: "0 12px 32px rgba(31, 47, 41, 0.07)"
    }
  },
  aurora: {
    id: "aurora",
    label: "Aurora",
    className: "theme-aurora",
    tokens: {
      background: "#edf7f3",
      surface: "#ffffff",
      primary: "#157a6e",
      secondary: "#4b5f9f",
      accent: "#ff7f6e",
      text: "#16302d",
      muted: "#536c66",
      border: "#cfe4dd",
      shadow: "0 18px 42px rgba(21, 122, 110, 0.12)"
    }
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    className: "theme-midnight",
    tokens: {
      background: "#111827",
      surface: "#1f2937",
      primary: "#8bd3ff",
      secondary: "#d8b4fe",
      accent: "#facc15",
      text: "#f8fafc",
      muted: "#b6c2cf",
      border: "#334155",
      shadow: "0 22px 48px rgba(0, 0, 0, 0.28)"
    }
  },
  playful: {
    id: "playful",
    label: "Playful",
    className: "theme-playful",
    tokens: {
      background: "#fff7ed",
      surface: "#ffffff",
      primary: "#e4572e",
      secondary: "#2f80ed",
      accent: "#27ae60",
      text: "#2b241f",
      muted: "#76685e",
      border: "#f1d4bd",
      shadow: "0 16px 38px rgba(228, 87, 46, 0.13)"
    }
  },
  warm: {
    id: "warm",
    label: "Warm",
    className: "theme-warm",
    tokens: {
      background: "#fff8f1",
      surface: "#fffefd",
      primary: "#b75f3a",
      secondary: "#8a5a78",
      accent: "#e9a23b",
      text: "#2e221d",
      muted: "#77645b",
      border: "#efd8ca",
      shadow: "0 18px 40px rgba(183, 95, 58, 0.13)"
    }
  },
  electric: {
    id: "electric",
    label: "Electric",
    className: "theme-electric",
    tokens: {
      background: "#eef2ff",
      surface: "#ffffff",
      primary: "#2354ff",
      secondary: "#08a88a",
      accent: "#ff4f8b",
      text: "#111827",
      muted: "#5d6474",
      border: "#cfd8ff",
      shadow: "0 18px 42px rgba(35, 84, 255, 0.13)"
    }
  }
} as const satisfies Record<PresentationThemeId, ResultTheme>;

export function getResultTheme(themeId: PresentationThemeId): ResultTheme {
  return resultThemes[themeId];
}
