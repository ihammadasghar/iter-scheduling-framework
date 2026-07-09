import { Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate } from 'react-router-dom';

export default function BackButton(): React.ReactElement {
  const navigate = useNavigate();
  return (
    <Button
      variant="text"
      startIcon={<ArrowBackIcon />}
      onClick={() => navigate('/admin/proposals')}
    >
      Back to Proposals
    </Button>
  );
}
