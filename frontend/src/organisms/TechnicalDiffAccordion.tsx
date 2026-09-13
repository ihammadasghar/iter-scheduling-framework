import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { defineMessages, useIntl } from 'react-intl';

const messages = defineMessages({
  showTechnicalDetails: {
    id: 'technicalDiffAccordion.showTechnicalDetails',
    defaultMessage: 'Show technical details (for IT use)',
  },
});

interface TechnicalDiffAccordionProps {
  readonly rawDiff: string;
}

export default function TechnicalDiffAccordion({
  rawDiff,
}: TechnicalDiffAccordionProps): React.ReactElement {
  const intl = useIntl();
  return (
    <Accordion disableGutters defaultExpanded={false} sx={{ mt: 3 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" color="text.secondary">
          {intl.formatMessage(messages.showTechnicalDetails)}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography
          component="pre"
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            bgcolor: 'action.hover',
            p: 2,
            borderRadius: 1,
            overflowX: 'auto',
          }}
        >
          {rawDiff}
        </Typography>
      </AccordionDetails>
    </Accordion>
  );
}
