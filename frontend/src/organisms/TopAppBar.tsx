import {
  AppBar,
  Box,
  Button,
  Chip,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearIdentity } from '@/store/reducers/identitySlice';
import { setLocale } from '@/store/reducers/languageSlice';
import { LOCALE_LABELS, SUPPORTED_LOCALES, type SupportedLocale } from '@/i18n/config';

const messages = defineMessages({
  goToHome: {
    id: 'topAppBar.goToHome',
    defaultMessage: 'Go to home',
  },
  mainNavigation: {
    id: 'topAppBar.mainNavigation',
    defaultMessage: 'Main navigation',
  },
  mySimulations: {
    id: 'topAppBar.mySimulations',
    defaultMessage: 'My Proposals',
  },
  mySimulationsTooltip: {
    id: 'topAppBar.mySimulationsTooltip',
    defaultMessage: 'View and manage your draft proposals',
  },
  proposals: {
    id: 'topAppBar.proposals',
    defaultMessage: 'Proposals',
  },
  proposalsTooltip: {
    id: 'topAppBar.proposalsTooltip',
    defaultMessage: 'Review and publish incoming schedule proposals',
  },
  rules: {
    id: 'topAppBar.rules',
    defaultMessage: 'Rules',
  },
  rulesTooltip: {
    id: 'topAppBar.rulesTooltip',
    defaultMessage: 'Configure scheduling rules and constraints',
  },
  demoOnly: {
    id: 'topAppBar.demoOnly',
    defaultMessage: 'DEMO ONLY',
  },
  changeIdentityTooltip: {
    id: 'topAppBar.changeIdentityTooltip',
    defaultMessage: "Choose a different role or person — there's no real login in this demo",
  },
  changeIdentity: {
    id: 'topAppBar.changeIdentity',
    defaultMessage: 'Change Identity',
  },
  languageSelectLabel: {
    id: 'topAppBar.languageSelectLabel',
    defaultMessage: 'Language',
  },
});

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
          color: active ? 'onPrimaryContainer' : 'text.secondary',
          bgcolor: active ? 'primaryContainer' : 'transparent',
          borderRadius: '999px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          px: 2,
          transition: 'color 0.15s, background-color 0.15s',
          '&:hover': {
            color: active ? 'onPrimaryContainer' : 'primary.main',
            bgcolor: active ? 'primaryContainer' : 'surfaceContainer',
          },
          // Enforce 44px minimum touch target
          minWidth: '44px',
        }}
      >
        {label}
      </Typography>
    </Tooltip>
  );
}

export default function TopAppBar(): React.ReactElement {
  const intl = useIntl();
  const dispatch = useAppDispatch();
  const role = useAppSelector((s) => s.identity.identity?.role);
  const locale = useAppSelector((s) => s.language.locale);

  const handleChangeIdentity = (): void => {
    // Clearing identity reopens OnboardingFlow (App.tsx) automatically —
    // there's exactly one place that asks "who's using this," reused both
    // on first load and here.
    dispatch(clearIdentity());
  };

  const handleLocaleChange = (event: SelectChangeEvent): void => {
    dispatch(setLocale(event.target.value as SupportedLocale));
  };

  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ height: 64 }}
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
        <Tooltip title={intl.formatMessage(messages.goToHome)}>
          <Typography
            component={Link}
            to="/"
            variant="h3"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              textDecoration: 'none',
              color: 'text.primary',
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '10px',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <CalendarMonth fontSize="small" />
            </Box>
            ITER
          </Typography>
        </Tooltip>

        {/* Nav links */}
        <Box
          component="nav"
          aria-label={intl.formatMessage(messages.mainNavigation)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 64, flexGrow: 1 }}
        >
          {(role === 'professor' || role === 'student') && (
            <NavLink
              href="/"
              label={intl.formatMessage(messages.mySimulations)}
              tooltip={intl.formatMessage(messages.mySimulationsTooltip)}
            />
          )}
          {role === 'admin' && (
            <>
              <NavLink
                href="/admin/proposals"
                label={intl.formatMessage(messages.proposals)}
                tooltip={intl.formatMessage(messages.proposalsTooltip)}
              />
              <NavLink
                href="/admin/rules"
                label={intl.formatMessage(messages.rules)}
                tooltip={intl.formatMessage(messages.rulesTooltip)}
              />
            </>
          )}
        </Box>

        {/* Right side: language switcher + demo chip + change identity */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <Select
            value={locale}
            onChange={handleLocaleChange}
            size="small"
            aria-label={intl.formatMessage(messages.languageSelectLabel)}
            sx={{ height: 44, minWidth: 96 }}
          >
            {SUPPORTED_LOCALES.map((supportedLocale) => (
              <MenuItem key={supportedLocale} value={supportedLocale}>
                {LOCALE_LABELS[supportedLocale]}
              </MenuItem>
            ))}
          </Select>
          <Chip
            label={intl.formatMessage(messages.demoOnly)}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600, letterSpacing: '0.05em', cursor: 'default' }}
          />
          <Tooltip title={intl.formatMessage(messages.changeIdentityTooltip)}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleChangeIdentity}
              aria-label={intl.formatMessage(messages.changeIdentity)}
            >
              {intl.formatMessage(messages.changeIdentity)}
            </Button>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
