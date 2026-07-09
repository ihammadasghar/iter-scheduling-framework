import { createTheme } from '@mui/material/styles';

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

const theme = createTheme({
  palette: {
    primary: {
      main: '#004d99',
      contrastText: '#ffffff',
      light: '#a9c7ff',
      dark: '#001b3d',
    },
    secondary: {
      main: '#046b5e',
      contrastText: '#ffffff',
      light: '#84d5c5',
      dark: '#00201b',
    },
    error: {
      main: '#ba1a1a',
      contrastText: '#ffffff',
      light: '#ffdad6',
      dark: '#93000a',
    },
    success: {
      main: '#198754',
      contrastText: '#ffffff',
      light: '#d1e7dd',
      dark: '#0f5132',
    },
    warning: {
      main: '#813900',
      contrastText: '#ffffff',
      light: '#ffdbc9',
      dark: '#321200',
    },
    background: {
      default: '#f9f9ff',
      paper: '#f9f9ff',
    },
    text: {
      primary: '#191c21',
      secondary: '#424752',
      disabled: '#727783',
    },
    divider: '#c2c6d4',
    // MD3 surface/outline tokens
    surfaceContainer: '#ecedf6',
    surfaceContainerLow: '#f2f3fb',
    surfaceContainerHigh: '#e7e8f0',
    outlineVariant: '#c2c6d4',
    primaryContainer: '#1565c0',
    onPrimaryContainer: '#dae5ff',
    secondaryContainer: '#9defde',
    onSecondaryContainer: '#0f6f62',
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
      fontSize: '2rem',       // 32px
      lineHeight: 1.25,
      fontWeight: 700,
      letterSpacing: '-0.01em',
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
      fontWeight: 600,
      letterSpacing: '0.05em',
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
    borderRadius: 4,
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
          borderRadius: '8px',
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
          background-color: #f9f9ff;
          color: #191c21;
          font-family: "Inter", sans-serif;
        }
        /* Visible focus ring for keyboard navigation (WCAG) */
        :focus-visible {
          outline: 2px solid #004d99;
          outline-offset: 2px;
        }
      `,
    },

    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 0 0 #c2c6d4',
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          border: '1px solid #e7e8f0',
          boxShadow: 'none',
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: '16px',
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
          borderRadius: '4px',
          height: '4px',
        },
      },
    },

    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
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
