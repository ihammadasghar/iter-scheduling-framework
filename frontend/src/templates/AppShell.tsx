import { Box } from '@mui/material';
import TopAppBar from '@/organisms/TopAppBar';

interface AppShellProps {
  readonly children: React.ReactNode;
}

/**
 * Persistent application frame — renders the top app bar above all page content.
 * Every page wraps its content in AppShell.
 */
export default function AppShell({ children }: AppShellProps): React.ReactElement {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopAppBar />
      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
