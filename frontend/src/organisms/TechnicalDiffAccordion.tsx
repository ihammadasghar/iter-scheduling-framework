import { Accordion, AccordionDetails, AccordionSummary, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface TechnicalDiffAccordionProps {
  readonly rawDiff: string;
}

export default function TechnicalDiffAccordion({
  rawDiff,
}: TechnicalDiffAccordionProps): React.ReactElement {
  return (
    <Accordion disableGutters defaultExpanded={false} sx={{ mt: 3 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="body2" color="text.secondary">
          Show technical details (for IT use)
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
