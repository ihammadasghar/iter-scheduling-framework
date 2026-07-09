import { useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setRole } from '@/store/reducers/uiSlice';
import type { UserRole } from '@/types';

// Returns true when the given path is considered "active" for a nav link.
const isActive = (href: string, pathname: string): boolean =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

interface NavLinkProps {
  readonly href: string;
  readonly label: string;
  readonly tooltip: string;
}

function NavLink({ href, label, tooltip }: NavLinkProps): React.ReactElement {
  const { pathname } = useLocation();
  const active = isActive(href, pathname);

  return (
    <Tooltip title={tooltip} arrow>
      <Typography
        component={Link}
        to={href}
        variant="body2"
        sx={{
          textDecoration: 'none',
          fontWeight: active ? 700 : 500,
          color: active ? 'primary.main' : 'text.secondary',
          borderBottom: active ? '2px solid' : '2px solid transparent',
          borderColor: active ? 'primary.main' : 'transparent',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          px: 1,
          transition: 'color 0.15s, border-color 0.15s',
          '&:hover': { color: 'primary.main' },
          // Enforce 44px minimum touch target width
          minWidth: '44px',
        }}
      >
        {label}
      </Typography>
    </Tooltip>
  );
}

interface RoleSwitchDialogProps {
  readonly open: boolean;
  readonly targetRole: UserRole;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function RoleSwitchDialog({
  open,
  targetRole,
  onConfirm,
  onCancel,
}: RoleSwitchDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>
        {targetRole === 'admin' ? 'Switch to Admin View' : 'Switch to User View'}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1">
          {targetRole === 'admin'
            ? 'You are now viewing as Admin. Changes you make here affect the published rules.'
            : 'You are switching back to the standard user view.'}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="outlined">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="contained" autoFocus>
          {targetRole === 'admin' ? 'Continue as Admin' : 'Switch to User View'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function TopAppBar(): React.ReactElement {
  const dispatch = useAppDispatch();
  const role = useAppSelector((state) => state.ui.role);
  const [dialogOpen, setDialogOpen] = useState(false);
  const targetRole: UserRole = role === 'user' ? 'admin' : 'user';

  const handleSwitchClick = (): void => setDialogOpen(true);
  const handleCancel = (): void => setDialogOpen(false);
  const handleConfirm = (): void => {
    dispatch(setRole(targetRole));
    setDialogOpen(false);
  };

  return (
    <>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ height: 64, borderBottom: '1px solid', borderColor: 'outlineVariant' }}
      >
        <Toolbar
          sx={{
            height: 64,
            minHeight: '64px !important',
            px: { xs: 2, sm: 3 },
            gap: 4,
          }}
        >
          {/* Logo */}
          <Tooltip title="Go to home">
            <Typography
              component={Link}
              to="/"
              variant="h3"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                textDecoration: 'none',
                color: 'primary.main',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              <CalendarMonth fontSize="medium" />
              UniSchedule
            </Typography>
          </Tooltip>

          {/* Nav links */}
          <Box
            component="nav"
            aria-label="Main navigation"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 64, flexGrow: 1 }}
          >
            {role === 'user' && (
              <NavLink
                href="/"
                label="My Simulations"
                tooltip="View and manage your draft simulations"
              />
            )}
            {role === 'admin' && (
              <>
                <NavLink
                  href="/admin/proposals"
                  label="Proposals"
                  tooltip="Review and publish incoming schedule proposals"
                />
                <NavLink
                  href="/admin/rules"
                  label="Rules"
                  tooltip="Configure scheduling rules and constraints"
                />
              </>
            )}
          </Box>

          {/* Right side: Demo chip + role toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
            <Chip
              label="DEMO ONLY"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 600, letterSpacing: '0.05em', cursor: 'default' }}
            />
            <Tooltip
              title={
                role === 'user'
                  ? 'Switch to the Admin view to manage rules and review proposals'
                  : 'Switch back to the standard scheduling user view'
              }
            >
              <Button
                variant="outlined"
                size="small"
                onClick={handleSwitchClick}
                aria-label={
                  role === 'user' ? 'Switch to Admin View' : 'Switch to User View'
                }
              >
                {role === 'user' ? 'Switch to Admin View' : 'Switch to User View'}
              </Button>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      <RoleSwitchDialog
        open={dialogOpen}
        targetRole={targetRole}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}
