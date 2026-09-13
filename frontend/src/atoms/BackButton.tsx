import { Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  backToProposals: {
    id: 'backButton.backToProposals',
    defaultMessage: 'Back to Proposals',
  },
});

export default function BackButton(): React.ReactElement {
  const intl = useIntl();
  const navigate = useNavigate();
  return (
    <Button
      variant="text"
      startIcon={<ArrowBackIcon />}
      onClick={() => navigate('/admin/proposals')}
    >
      {intl.formatMessage(messages.backToProposals)}
    </Button>
  );
}
