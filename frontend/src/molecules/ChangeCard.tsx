import { Box, Card, CardContent, Divider, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { ClassChange } from '@/utils/diffParser';

interface ChangeCardProps {
  readonly change: ClassChange;
}

export default function ChangeCard({ change }: ChangeCardProps): React.ReactElement {
  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
          {change.className}
        </Typography>
        <Divider sx={{ mb: 1.5 }} />
        {change.changes.map((fc, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              mb: 1,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ minWidth: 80, fontWeight: 500 }}
            >
              {fc.field}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'error.lighter',
                color: 'error.dark',
                textDecoration: 'line-through',
              }}
            >
              {fc.from}
            </Typography>
            <ArrowForwardIcon fontSize="small" color="action" aria-hidden />
            <Typography
              variant="body2"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                bgcolor: 'success.lighter',
                color: 'success.dark',
              }}
            >
              {fc.to}
            </Typography>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}
