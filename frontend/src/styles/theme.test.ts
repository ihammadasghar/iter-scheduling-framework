import { describe, it, expect } from 'vitest';
import theme from '../styles/theme';

describe('theme', () => {
  it('primary colour matches MD3 token', () => {
    expect(theme.palette.primary.main).toBe('#004d99');
  });

  it('secondary colour matches MD3 token', () => {
    expect(theme.palette.secondary.main).toBe('#046b5e');
  });

  it('background default is surface colour', () => {
    expect(theme.palette.background.default).toBe('#f9f9ff');
  });

  it('body1 font size is 1rem (16px minimum)', () => {
    expect(theme.typography.body1.fontSize).toBe('1rem');
  });

  it('body2 font size is 0.875rem (14px minimum for secondary labels)', () => {
    expect(theme.typography.body2.fontSize).toBe('0.875rem');
  });

  it('button text is not uppercased', () => {
    expect(theme.typography.button.textTransform).toBe('none');
  });

  it('font family is Inter', () => {
    expect(theme.typography.fontFamily).toContain('Inter');
  });

  it('MuiButton has 44px minimum height for WCAG touch target', () => {
    const buttonOverride = theme.components?.MuiButton?.styleOverrides?.root as Record<string, unknown>;
    expect(buttonOverride?.minHeight).toBe('44px');
  });

  it('MuiIconButton has 44px minimum dimensions for WCAG touch target', () => {
    const override = theme.components?.MuiIconButton?.styleOverrides?.root as Record<string, unknown>;
    expect(override?.minHeight).toBe('44px');
    expect(override?.minWidth).toBe('44px');
  });

  it('MuiChip has at least 32px height', () => {
    const override = theme.components?.MuiChip?.styleOverrides?.root as Record<string, unknown>;
    expect(override?.height).toBe('32px');
  });

  it('Snackbar auto-hides after 8 seconds', () => {
    const snackbarProps = theme.components?.MuiSnackbar?.defaultProps;
    expect(snackbarProps?.autoHideDuration).toBe(8000);
  });

  it('custom MD3 surface tokens are defined', () => {
    expect(theme.palette.surfaceContainer).toBe('#ecedf6');
    expect(theme.palette.outlineVariant).toBe('#c2c6d4');
    expect(theme.palette.primaryContainer).toBe('#1565c0');
  });
});
