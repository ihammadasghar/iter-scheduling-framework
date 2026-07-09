import { Box, Button, Typography } from '@mui/material';
import { SentimentDissatisfied } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage(): React.ReactElement {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 3,
        px: 2,
        textAlign: 'center',
      }}
    >
      <SentimentDissatisfied sx={{ fontSize: 64, color: 'text.secondary' }} />
      <Typography variant="h2" component="h1">
        Page not found
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
        The page you were looking for doesn&apos;t exist. It may have been moved or the link may be
        incorrect.
      </Typography>
      <Button variant="contained" size="large" onClick={() => navigate('/')}>
        Go to My Simulations
      </Button>
    </Box>
  );
}
