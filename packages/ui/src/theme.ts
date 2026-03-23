export interface Theme {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderSub: string;
  text: string;
  textSub: string;
  textMuted: string;
  primary: string;
  primaryBright: string;
  primaryLight: string;
  primaryBg: string;
  coral: string;
  coralBg: string;
  amber: string;
  amberBg: string;
  isDark: boolean;
}

export const lightTheme: Theme = {
  bg:           '#F6F8F5',
  surface:      '#FFFFFF',
  surfaceAlt:   '#E8ECE5',
  border:       '#E0E4E0',
  borderSub:    '#D1D9CC',
  text:         '#1A1D1A',
  textSub:      '#5A625A',
  textMuted:    '#9CA59C',
  primary:      '#1A9E96',
  primaryBright:'#22C9BF',
  primaryLight: '#EEFCFB',
  primaryBg:    '#E6F7F6',
  coral:        '#F0735A',
  coralBg:      '#FEE9E4',
  amber:        '#F5A623',
  amberBg:      '#FFF3DC',
  isDark:       false,
};

export const darkTheme: Theme = {
  bg:           '#0D1613',
  surface:      '#0F1F1C',
  surfaceAlt:   '#152825',
  border:       '#1C3530',
  borderSub:    '#253D39',
  text:         '#E8ECE5',
  textSub:      '#9CA59C',
  textMuted:    '#5A625A',
  primary:      '#22C9BF',
  primaryBright:'#5EDDD5',
  primaryLight: '#0F2420',
  primaryBg:    '#0F2420',
  coral:        '#F4937F',
  coralBg:      '#2A1510',
  amber:        '#F7BE5A',
  amberBg:      '#261A07',
  isDark:       true,
};

export const radius = {
  sm:   8,
  md:   16,
  lg:   24,
  xl:   32,
  pill: 100,
} as const;

export const fonts = {
  heading:  'Fraunces-Bold',
  body:     'DMSans-Regular',
  bodyMed:  'DMSans-Medium',
  bodySemi: 'DMSans-SemiBold',
  mono:     'JetBrainsMono-Regular',
} as const;
