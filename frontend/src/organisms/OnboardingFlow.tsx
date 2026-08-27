import { useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setIdentity } from '@/store/reducers/identitySlice';
import type { UserRole } from '@/types';

type Step = 'role' | 'identity';

interface RoleOption {
  readonly role: UserRole;
  readonly label: string;
  readonly description: string;
}

const ROLE_OPTIONS: readonly RoleOption[] = [
  { role: 'professor', label: 'Professor', description: 'I teach classes and want to check or adjust my own schedule.' },
  { role: 'student', label: 'Student', description: 'I\'m part of a student group and want to check our class schedule.' },
  { role: 'admin', label: 'Scheduling Office (Admin)', description: 'I review and publish schedule change proposals.' },
];

/**
 * Gates the whole app on first load: who is using it, and (for a
 * Professor/Student) which one. Non-dismissable, same convention as
 * SessionExpiryModal — there's no sensible "cancel" here, since every other
 * screen assumes an identity exists. Reused later, unchanged, whenever the
 * user clicks "Change identity" in TopAppBar (that just clears identity,
 * which reopens this).
 */
export default function OnboardingFlow(): React.ReactElement | null {
  const dispatch = useAppDispatch();
  const identity = useAppSelector((s) => s.identity.identity);
  const hydrated = useAppSelector((s) => s.identity.hydrated);
  const professors = useAppSelector((s) => s.schedule.professors);
  const studentGroups = useAppSelector((s) => s.schedule.studentGroups);
  const rosterLoading = useAppSelector((s) => s.schedule.loading);

  const [step, setStep] = useState<Step>('role');
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [selectedId, setSelectedId] = useState('');

  const open = hydrated && identity === null;
  if (!open) return null;

  const handleChooseRole = (role: UserRole): void => {
    if (role === 'admin') {
      dispatch(setIdentity({ role: 'admin', professorId: null, studentGroupId: null }));
      return;
    }
    setPendingRole(role);
    setSelectedId('');
    setStep('identity');
  };

  const handleBack = (): void => {
    setStep('role');
    setPendingRole(null);
  };

  const handleConfirm = (): void => {
    if (pendingRole === null || selectedId === '') return;
    dispatch(setIdentity({
      role: pendingRole,
      professorId: pendingRole === 'professor' ? selectedId : null,
      studentGroupId: pendingRole === 'student' ? selectedId : null,
    }));
  };

  const identityOptions = pendingRole === 'professor' ? professors : studentGroups;
  const identityLabel = pendingRole === 'professor' ? 'Which professor are you?' : 'Which student group are you in?';

  return (
    <Dialog
      open
      maxWidth="xs"
      fullWidth
      // Non-dismissable: ignore both ESC and backdrop-click reasons — every
      // other screen assumes an identity exists, so there's no "cancel" here.
      onClose={(_event, reason) => {
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
      }}
      aria-labelledby="onboarding-title"
    >
      {step === 'role' ? (
        <>
          <DialogTitle id="onboarding-title">Welcome — who&apos;s using UniSchedule?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This tells us what to show you first. You can change this later from the top bar.
            </Typography>
            <Stack spacing={1.5}>
              {ROLE_OPTIONS.map((option) => (
                <Button
                  key={option.role}
                  variant="outlined"
                  onClick={() => handleChooseRole(option.role)}
                  sx={{ justifyContent: 'flex-start', textAlign: 'left', p: 2, flexDirection: 'column', alignItems: 'flex-start' }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 700 }}>{option.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{option.description}</Typography>
                </Button>
              ))}
            </Stack>
          </DialogContent>
        </>
      ) : (
        <>
          <DialogTitle id="onboarding-title">{identityLabel}</DialogTitle>
          <DialogContent>
            {rosterLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress aria-label="Loading roster…" />
              </Box>
            ) : (
              <FormControl fullWidth sx={{ mt: 1 }}>
                <InputLabel id="onboarding-identity-label">
                  {pendingRole === 'professor' ? 'Professor' : 'Student group'}
                </InputLabel>
                <Select
                  labelId="onboarding-identity-label"
                  label={pendingRole === 'professor' ? 'Professor' : 'Student group'}
                  inputProps={{ 'aria-label': pendingRole === 'professor' ? 'Professor' : 'Student group' }}
                  value={selectedId}
                  onChange={(e: SelectChangeEvent<string>) => setSelectedId(e.target.value)}
                >
                  {identityOptions.map((entity) => (
                    <MenuItem key={entity.id} value={entity.id}>{entity.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleBack}>Back</Button>
            <Button variant="contained" onClick={handleConfirm} disabled={selectedId === ''}>
              Confirm
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
