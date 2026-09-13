import { Box, Button, Typography } from '@mui/material';
import { SentimentDissatisfied } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import AppShell from '@/templates/AppShell';

const messages = defineMessages({
  title: {
    id: 'notFoundPage.title',
    defaultMessage: 'Page not found',
  },
  body: {
    id: 'notFoundPage.body',
    defaultMessage: "The page you were looking for doesn't exist. It may have been moved or the link may be incorrect.",
  },
  goHome: {
    id: 'notFoundPage.goHome',
    defaultMessage: 'Go to My Simulations',
  },
});

export default function NotFoundPage(): React.ReactElement {
  const intl = useIntl();
  const navigate = useNavigate();

  return (
    <AppShell>
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
          {intl.formatMessage(messages.title)}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400 }}>
          {intl.formatMessage(messages.body)}
        </Typography>
        <Button variant="contained" size="large" onClick={() => navigate('/')}>
          {intl.formatMessage(messages.goHome)}
        </Button>
      </Box>
    </AppShell>
  );
}
