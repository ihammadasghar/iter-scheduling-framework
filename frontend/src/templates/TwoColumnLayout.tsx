import { type ReactNode } from 'react';
import { Box } from '@mui/material';

interface TwoColumnLayoutProps {
  readonly left: ReactNode;
  readonly right: ReactNode;
}

export default function TwoColumnLayout({
  left,
  right,
}: TwoColumnLayoutProps): React.ReactElement {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 4,
      }}
    >
      <Box>{left}</Box>
      <Box>{right}</Box>
    </Box>
  );
}
