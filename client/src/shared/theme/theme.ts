/** Дизайн-токены. Единственное место, где живут цвета, отступы и длительности. */
export const theme = {
  colors: {
    background: '#f4f6f9',
    surface: '#ffffff',
    surfaceRaised: '#eef2f7',
    border: '#d9dfe7',
    text: '#1c2430',
    textMuted: '#5f6b7a',
    accent: '#2f6fed',
    accentSoft: '#e3ecfd',
    danger: '#d93f3f',
    perfLow: '#d93f3f',
    perfMid: '#e0a100',
    perfHigh: '#2e9e5b',
    flash: '#fff2b3',
    focusRing: '#2f6fed',
  },
  radius: {
    sm: '6px',
    md: '10px',
  },
  space: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },
  font: {
    base: '14px',
    small: '12.5px',
    heading: '20px',
  },
  duration: {
    expand: '220ms',
    flash: '1500ms',
  },
  breakpoints: {
    split: '1280px',
  },
} as const;

export type AppTheme = typeof theme;

/** Порог эффективности → цвет индикатора. */
export function performanceTone(value: number): 'low' | 'mid' | 'high' {
  if (value < 50) return 'low';
  if (value < 75) return 'mid';
  return 'high';
}

export function performanceColor(colors: AppTheme['colors'], value: number): string {
  const tone = performanceTone(value);
  if (tone === 'low') return colors.perfLow;
  if (tone === 'mid') return colors.perfMid;
  return colors.perfHigh;
}
