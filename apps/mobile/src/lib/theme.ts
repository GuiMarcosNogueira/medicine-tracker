/**
 * MedStock design tokens — aligned with visual-identity.html
 * Teal primary · Coral danger · Amber warning · Sage surfaces · Ink text
 */
export const colors = {
  // Teal — Primary
  teal900: '#0B3D3B',
  teal800: '#0F524F',
  teal700: '#147570',
  teal600: '#1A9E96',
  teal500: '#22C9BF',
  teal400: '#5EDDD5',
  teal300: '#A0EDE8',
  teal200: '#D0F7F5',
  teal100: '#EEFCFB',

  // Coral — Danger / Alert
  coral500: '#F0735A',
  coral400: '#F4937F',
  coral300: '#F8B8AB',
  coralBg:  '#FEE9E4',

  // Amber — Warning / Attention
  amber500: '#F5A623',
  amber400: '#F7BE5A',
  amberBg:  '#FFF3DC',

  // Sage — Surfaces
  sage50:  '#F6F8F5',
  sage100: '#E8ECE5',
  sage200: '#D1D9CC',

  // Ink — Text
  ink900: '#1A1D1A',
  ink700: '#2E332E',
  ink500: '#5A625A',
  ink300: '#9CA59C',
  ink100: '#E0E4E0',

  white: '#FFFFFF',
} as const;

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

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 6,
  },
} as const;
