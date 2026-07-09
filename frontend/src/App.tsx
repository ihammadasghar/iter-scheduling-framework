import { ThemeProvider, CssBaseline } from '@mui/material';
import theme from '@/styles/theme';
import GlobalStyles from '@/styles/GlobalStyles';

interface AppProps {
  readonly children?: React.ReactNode;
}

/**
 * Root application wrapper — provides MUI theme, CSS baseline, and global styles.
 * Router, Redux Provider, and routes are added in Task 06 (App Shell).
 */
export default function App({ children }: AppProps): React.ReactElement {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles />
      {children}
    </ThemeProvider>
  );
}
