import { Platform } from 'react-native';

export const COLORS = {
  surface: '#F4EFE6',
  onSurface: '#2C221B',
  surfaceSecondary: '#E8DFD1',
  onSurfaceSecondary: '#4A3C31',
  surfaceTertiary: '#DCD0BF',
  onSurfaceTertiary: '#2C221B',
  surfaceInverse: '#3E2A1E',
  onSurfaceInverse: '#F4EFE6',
  brand: '#8C5A35',
  brandPrimary: '#8C5A35',
  onBrandPrimary: '#F4EFE6',
  brandSecondary: '#6B4423',
  onBrandSecondary: '#F4EFE6',
  brandTertiary: '#D5B59C',
  onBrandTertiary: '#3E2A1E',
  success: '#4A6B48',
  onSuccess: '#FFFFFF',
  warning: '#C27A30',
  onWarning: '#FFFFFF',
  error: '#A84432',
  onError: '#FFFFFF',
  border: '#DCD0BF',
  borderStrong: '#8C5A35',
  divider: '#DCD0BF',
};

export const FONTS = {
  display: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' })!,
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!,
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const fmtEUR = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};
