import { useEffect, useState } from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import { Add, InboxOutlined } from '@mui/icons-material';
import AppShell from '@/templates/AppShell';
import EmptyState from '@/atoms/EmptyState';
import SimulationCard from '@/organisms/SimulationCard';
import SimulationCardSkeleton from '@/organisms/SimulationCardSkeleton';
import PublishedScheduleCard from '@/organisms/PublishedScheduleCard';
import CreateSimulationDialog from '@/molecules/CreateSimulationDialog';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { loadSimulationsFromStorage } from '@/store/reducers/simulationSlice';

export default function SimulationDashboardPage(): React.ReactElement {
  const dispatch = useAppDispatch();
  const simulations = useAppSelector((state) => state.simulation.simulations);
  const loading = useAppSelector((state) => state.simulation.loading);

  const [createOpen, setCreateOpen] = useState(false);

  // Hydrate simulation list from localStorage on first mount
  useEffect(() => {
    dispatch(loadSimulationsFromStorage());
  }, [dispatch]);

  const handleCreate = (): void => {
    setCreateOpen(true);
  };

  return (
    <AppShell>
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Page header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
          <Typography variant="h1" component="h1">
            My Simulations
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={handleCreate}
          >
            + Create New Simulation
          </Button>
        </Box>

        {/* Published schedule reference card */}
        <PublishedScheduleCard />

        {/* Section heading */}
        <Typography variant="overline" color="text.secondary" component="h2" sx={{ display: 'block', mb: 1 }}>
          My Draft Simulations
        </Typography>

        {/* Loading skeleton */}
        {loading && simulations.length === 0 && (
          <>
            <SimulationCardSkeleton />
            <SimulationCardSkeleton />
          </>
        )}

        {/* Empty state */}
        {!loading && simulations.length === 0 && (
          <EmptyState
            Icon={InboxOutlined}
            message="You haven't started any simulations yet."
            ctaLabel="Create your first simulation"
            onCta={handleCreate}
          />
        )}

        {/* Simulation cards */}
        {simulations.map((sim) => (
          <SimulationCard key={sim.id} simulation={sim} />
        ))}
      </Container>

      <CreateSimulationDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </AppShell>
  );
}
