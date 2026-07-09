import { GlobalStyles as MuiGlobalStyles } from '@mui/material';

/**
 * Custom scrollbar styles and any global CSS not covered by CssBaseline.
 * Matches the scrollbar design from ui_example.html.
 */
export default function GlobalStyles(): React.ReactElement {
  return (
    <MuiGlobalStyles
      styles={{
        /* Custom scrollbar — WebKit */
        '::-webkit-scrollbar': {
          width: '8px',
          height: '8px',
        },
        '::-webkit-scrollbar-track': {
          background: '#f2f3fb',
        },
        '::-webkit-scrollbar-thumb': {
          background: '#c2c6d4',
          borderRadius: '4px',
        },
        '::-webkit-scrollbar-thumb:hover': {
          background: '#727783',
        },
        /* Ensure #root fills the viewport */
        '#root': {
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    />
  );
}
