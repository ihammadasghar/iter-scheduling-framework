import { createTheme, alpha } from '@mui/material/styles';
import type { Shadows, Theme } from '@mui/material/styles';

// Extend MUI palette with MD3 surface/outline tokens
declare module '@mui/material/styles' {
  interface Palette {
    readonly surfaceContainer: string;
    readonly surfaceContainerLow: string;
    readonly surfaceContainerHigh: string;
    readonly outlineVariant: string;
    readonly primaryContainer: string;
    readonly onPrimaryContainer: string;
    readonly secondaryContainer: string;
    readonly onSecondaryContainer: string;
  }
  interface PaletteOptions {
    readonly surfaceContainer?: string;
    readonly surfaceContainerLow?: string;
    readonly surfaceContainerHigh?: string;
    readonly outlineVariant?: string;
    readonly primaryContainer?: string;
    readonly onPrimaryContainer?: string;
    readonly secondaryContainer?: string;
    readonly onSecondaryContainer?: string;
  }
}

// A soft, indigo-tinted shadow scale replacing MUI's default flat-black
// shadows — every component that reads elevation from theme.shadows[n]
// (Card, Menu, Popover, Dialog, Select dropdown, Tooltip) picks this up for
// a cohesive "floating surface" look in one place, instead of the harsh
// default Material 2 shadow set.
const SHADOW_TINT = '31, 41, 102'; // deep indigo, matches the new primary hue
const softShadow = (elevation: number): string => {
  if (elevation === 0) return 'none';
  const yOffset = Math.round(elevation * 0.6);
  const blur = Math.round(2 + elevation * 1.6);
  const spread = elevation > 6 ? 1 : 0;
  const opacity = Math.max(0.05, 0.14 - elevation * 0.0035).toFixed(3);
  return `0 ${yOffset}px ${blur}px ${spread}px rgba(${SHADOW_TINT}, ${opacity})`;
};
const shadows = Array.from({ length: 25 }, (_, i) => softShadow(i)) as Shadows;

const theme = createTheme({
  shadows,

  palette: {
    primary: {
      main: '#3454d8',
      contrastText: '#ffffff',
      light: '#3f66dc',
      dark: '#1f39ad',
    },
    secondary: {
      main: '#0a6f64',
      contrastText: '#ffffff',
      light: '#3fc9b3',
      dark: '#043d37',
    },
    error: {
      main: '#ba1a1a',
      contrastText: '#ffffff',
      light: '#ffdad6',
      dark: '#93000a',
    },
    success: {
      main: '#127a48',
      contrastText: '#ffffff',
      light: '#d7f2e3',
      dark: '#0a4a2c',
    },
    warning: {
      main: '#b45309',
      contrastText: '#ffffff',
      light: '#ffe8cf',
      dark: '#7c2d12',
    },
    background: {
      // Two-tier neutral: a slightly deeper page background so white cards
      // ("paper") read as visibly elevated even before shadows are added.
      default: '#f5f6fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#191c21',
      secondary: '#424752',
      disabled: '#727783',
    },
    divider: '#d9dcec',
    // MD3 surface/outline tokens
    surfaceContainer: '#eef0f9',
    surfaceContainerLow: '#f7f8fc',
    surfaceContainerHigh: '#e5e8f4',
    outlineVariant: '#d9dcec',
    primaryContainer: '#0f2e94',
    onPrimaryContainer: '#dee6ff',
    secondaryContainer: '#a7f0e0',
    onSecondaryContainer: '#075e53',
  },

  typography: {
    fontFamily: '"Inter", sans-serif',
    // 16px body minimum (WCAG)
    body1: {
      fontSize: '1rem',       // 16px
      lineHeight: 1.5,        // 24px
      fontWeight: 400,
    },
    // 14px floor for secondary labels
    body2: {
      fontSize: '0.875rem',   // 14px
      lineHeight: '20px',
      fontWeight: 400,
    },
    h1: {
      fontSize: '2.25rem',    // 36px — bolder page-title presence
      lineHeight: 1.2,
      fontWeight: 800,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontSize: '1.5rem',     // 24px
      lineHeight: 1.33,
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontSize: '1.25rem',    // 20px
      lineHeight: 1.4,
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.125rem',   // 18px
      lineHeight: '24px',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1rem',       // 16px
      lineHeight: '24px',
      fontWeight: 600,
    },
    h6: {
      fontSize: '0.875rem',   // 14px
      lineHeight: '20px',
      fontWeight: 600,
    },
    overline: {
      fontSize: '0.8125rem',  // 13px
      lineHeight: '16px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
    },
    caption: {
      fontSize: '0.75rem',    // 12px
      lineHeight: '16px',
      fontWeight: 500,
    },
    button: {
      fontSize: '0.875rem',   // 14px
      fontWeight: 600,
      textTransform: 'none',  // No ALL-CAPS on buttons
    },
  },

  shape: {
    borderRadius: 10,
  },

  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          // WCAG touch target: 44×44px minimum
          minHeight: '44px',
          minWidth: '44px',
          paddingLeft: '16px',
          paddingRight: '16px',
          borderRadius: '10px',
        },
        sizeLarge: {
          minHeight: '48px',
          paddingLeft: '24px',
          paddingRight: '24px',
          fontSize: '1rem',
        },
        sizeSmall: {
          minHeight: '36px',
          paddingLeft: '12px',
          paddingRight: '12px',
        },
        contained: {
          boxShadow: `0 2px 8px 0 rgba(${SHADOW_TINT}, 0.28)`,
          '&:hover': {
            boxShadow: `0 4px 14px 0 rgba(${SHADOW_TINT}, 0.34)`,
          },
        },
      },
    },

    MuiIconButton: {
      styleOverrides: {
        root: {
          // WCAG touch target: 44×44px minimum
          minWidth: '44px',
          minHeight: '44px',
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          height: '32px',
          fontSize: '0.875rem',
        },
      },
      variants: [
        // Soft-filled status pills (tinted container + matching dark text)
        // instead of a solid saturated block with white text — used by
        // every status Chip (ProposalStatusChip, CIStatusBadge, ConflictChip,
        // etc.) automatically, since they all go through color="..." already.
        ...(['success', 'warning', 'error', 'info'] as const).map((key) => ({
          props: { variant: 'filled' as const, color: key },
          style: ({ theme: t }: { theme: Theme }) => ({
            backgroundColor: alpha(t.palette[key].main, 0.16),
            color: t.palette[key].dark,
            '& .MuiChip-icon': {
              color: t.palette[key].dark,
            },
          }),
        })),
      ],
    },

    MuiTooltip: {
      defaultProps: {
        enterDelay: 300,
        arrow: true,
      },
    },

    MuiCssBaseline: {
      styleOverrides: `
        *, *::before, *::after {
          box-sizing: border-box;
        }
        html {
          font-size: 16px;
          -webkit-text-size-adjust: 100%;
        }
        body {
          margin: 0;
          background-color: #f5f6fb;
          color: #191c21;
          font-family: "Inter", sans-serif;
        }
        /* Visible focus ring for keyboard navigation (WCAG) */
        :focus-visible {
          outline: 2px solid #3454d8;
          outline-offset: 2px;
        }
      `,
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: `0 1px 0 0 #e5e8f4, 0 2px 10px 0 rgba(${SHADOW_TINT}, 0.06)`,
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          border: '1px solid #eceffa',
          boxShadow: `0 1px 2px 0 rgba(${SHADOW_TINT}, 0.05), 0 4px 16px 0 rgba(${SHADOW_TINT}, 0.06)`,
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: '20px',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: '0',
        },
      },
    },

    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: '6px',
          height: '4px',
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          fontSize: '1rem',       // 16px — readable for older users
          lineHeight: 1.5,
        },
      },
    },

    MuiSnackbar: {
      defaultProps: {
        autoHideDuration: 8000,  // 8s — longer for older users per DESIGN.md
        anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
      },
    },

    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        fullWidth: true,
      },
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            fontSize: '1rem',
          },
          '& .MuiInputLabel-root': {
            fontSize: '1rem',
          },
        },
      },
    },

    MuiSelect: {
      defaultProps: {
        variant: 'outlined',
      },
    },

    MuiTableCell: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
        },
      },
    },
  },
});

export default theme;
