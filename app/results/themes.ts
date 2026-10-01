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
      background: "#f5efe5",
      surface: "#fffaf1",
      primary: "#1f5f58",
      secondary: "#221a16",
      accent: "#d28b2c",
      text: "#211d18",
      muted: "#786f62",
      border: "#e5d6c2",
      shadow: "0 22px 60px rgba(56, 42, 28, 0.16)"
    }
  },
  aurora: {
    id: "aurora",
    label: "Aurora",
    className: "theme-aurora",
    tokens: {
      background: "#eef7ff",
      surface: "#fbfdff",
      primary: "#4a66ff",
      secondary: "#27c0c7",
      accent: "#ff7bc4",
      text: "#15213f",
      muted: "#60708d",
      border: "#cbd8ff",
      shadow: "0 28px 70px rgba(74, 102, 255, 0.2)"
    }
  },
  midnight: {
    id: "midnight",
    label: "Midnight",
    className: "theme-midnight",
    tokens: {
      background: "#070a18",
      surface: "#11172a",
      primary: "#6ee7ff",
      secondary: "#a78bfa",
      accent: "#f8e16c",
      text: "#f7fbff",
      muted: "#a9b6ca",
      border: "#2e3a58",
      shadow: "0 30px 80px rgba(0, 0, 0, 0.42)"
    }
  },
  playful: {
    id: "playful",
    label: "Playful",
    className: "theme-playful",
    tokens: {
      background: "#fff2f4",
      surface: "#ffffff",
      primary: "#ff4f8b",
      secondary: "#2f80ed",
      accent: "#27d17f",
      text: "#24142a",
      muted: "#7a6074",
      border: "#ffd1dd",
      shadow: "0 24px 56px rgba(255, 79, 139, 0.22)"
    }
  },
  warm: {
    id: "warm",
    label: "Warm",
    className: "theme-warm",
    tokens: {
      background: "#fff5e9",
      surface: "#fffdfa",
      primary: "#c65d4b",
      secondary: "#9b5c7f",
      accent: "#f0b44d",
      text: "#33211c",
      muted: "#80695d",
      border: "#f0d1bd",
      shadow: "0 24px 60px rgba(198, 93, 75, 0.18)"
    }
  },
  electric: {
    id: "electric",
    label: "Electric",
    className: "theme-electric",
    tokens: {
      background: "#eff2ff",
      surface: "#ffffff",
      primary: "#1a33ff",
      secondary: "#00b7a8",
      accent: "#ffcf21",
      text: "#0c1024",
      muted: "#58607b",
      border: "#bdc7ff",
      shadow: "0 26px 66px rgba(26, 51, 255, 0.22)"
    }
  }
} as const satisfies Record<PresentationThemeId, ResultTheme>;

export function getResultTheme(themeId: PresentationThemeId): ResultTheme {
  return resultThemes[themeId];
}
