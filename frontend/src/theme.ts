// Il sistema visivo del gestionale.
//
// I colori sono gli stessi del sito ferramenta-loperfido, campionati
// dall'insegna vera del negozio. Chi tocca questo file cambia l'aspetto di
// tutta l'app: è voluto. Nessun colore va scritto a mano nelle schermate —
// ci pensa scripts/check-theme.mjs a ricordarlo.

import type { TextStyle } from 'react-native';

// --- La tavolozza grezza -------------------------------------------------
// Usarla solo quando serve il colore preciso. Altrimenti usare COLORS.

export const PALETTE = {
  carta: '#F5EFE4',
  carta2: '#EBE0CF',
  carta3: '#DDCFB8',

  inchiostro: '#241C15',
  inchiostro2: '#5B4A3A',
  inchiostro3: '#8A7864',

  legnoLuce: '#F0A878',
  legnoChiaro: '#E0954F',
  legno: '#C07848',
  legnoScuro: '#96603A',
  legnoOmbra: '#784830',

  noce: '#3E2A1E',
  noce2: '#2A1B12',
  noce3: '#1A100A',

  verde: '#4A6B48',
  verdeScuro: '#2F4630',
  verdeChiaro: '#7D9C6A',

  minio: '#A84432',
  ottone: '#C9A227',
  acciaio: '#9AA0A6',
  acciaioBordo: '#5E6469',
  acciaioTaglio: '#3C4044',
} as const;

// Le tappe della venatura dell'asse: cinque gradi dal colpo di luce in alto
// all'ombra in basso. Stanno qui e non dentro Asse.tsx perche' chi vorra'
// ritoccare il legno deve trovarli insieme al resto della tavolozza.
// L'"as const" serve anche a expo-linear-gradient, che vuole una tupla.
export const VENATURA = [
  '#EAA066',
  '#DD9457',
  '#C9814C',
  '#B06D3F',
  PALETTE.legnoScuro,
] as const;

export const VENATURA_TAPPE = [0, 0.26, 0.58, 0.85, 1] as const;

// --- I token semantici ---------------------------------------------------
// I nomi sono quelli che le schermate già usano: cambiano solo i valori.

export const COLORS = {
  surface: PALETTE.carta,
  onSurface: PALETTE.inchiostro,
  surfaceSecondary: PALETTE.carta2,
  onSurfaceSecondary: PALETTE.inchiostro2,
  surfaceTertiary: PALETTE.carta3,
  onSurfaceTertiary: PALETTE.inchiostro,
  surfaceInverse: PALETTE.noce,
  onSurfaceInverse: PALETTE.carta,

  brand: PALETTE.legnoScuro,
  brandPrimary: PALETTE.legnoScuro,
  onBrandPrimary: PALETTE.carta,
  brandSecondary: PALETTE.legnoOmbra,
  onBrandSecondary: PALETTE.carta,
  brandTertiary: PALETTE.legnoLuce,
  onBrandTertiary: PALETTE.inchiostro,

  success: PALETTE.verde,
  onSuccess: '#FFFFFF',
  successSurface: '#E6EFE2',

  warning: PALETTE.ottone,
  // Bianco su ottone non si legge: il testo sopra il giallo va scuro.
  onWarning: PALETTE.inchiostro,
  warningSurface: '#F6EDD2',

  error: PALETTE.minio,
  onError: '#FFFFFF',
  errorSurface: '#F3E1DD',

  acciaio: PALETTE.acciaio,

  border: PALETTE.carta3,
  borderStrong: PALETTE.legnoScuro,
  divider: PALETTE.carta3,
} as const;

// --- I caratteri ---------------------------------------------------------
// Su Android i pesi non si sintetizzano: va indicata la famiglia esatta.
// Non usare fontWeight insieme a fontFamily.

export const FONTS = {
  display: 'Fraunces_700Bold',
  displayForte: 'Fraunces_900Black',
  testo: 'Archivo_400Regular',
  testoForte: 'Archivo_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoMedio: 'IBMPlexMono_500Medium',
} as const;

// --- Gli stili di testo di servizio, presi dal sito ----------------------

export const TESTO = {
  // L'etichetta da cassettiera: piccola, spaziata, in stampatello.
  cassetto: {
    fontFamily: FONTS.monoMedio,
    fontSize: 11,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  // Il numero da inventario: cifre a larghezza fissa, così le colonne di
  // prezzi non ballano.
  cifra: {
    fontFamily: FONTS.monoMedio,
    fontVariant: ['tabular-nums'],
  },
  titolo: {
    fontFamily: FONTS.displayForte,
    fontSize: 24,
    letterSpacing: -0.4,
  },
} as const satisfies Record<string, TextStyle>;

// --- Misure --------------------------------------------------------------

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

// Angoli quasi vivi, come le insegne smaltate del sito.
export const RADIUS = { sm: 2, md: 4, lg: 8 } as const;

export const OMBRE = {
  scheda: {
    shadowColor: PALETTE.noce3,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

export const fmtEUR = (n: number) => {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};
