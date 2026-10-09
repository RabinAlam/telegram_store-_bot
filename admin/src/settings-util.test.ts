import { describe, it, expect } from 'vitest';
import {
  displaySettingValue,
  secretPlaceholder,
  shouldSkipSecret,
  normalizeSettingInput,
} from './settings-util';

// The "easy input" contract: blanks stay blank, legacy quote junk is hidden,
// masks never leak into inputs, blank secrets are never sent.
describe('displaySettingValue', () => {
  it('shows blank for missing settings (never `"\"\"")', () => {
    expect(displaySettingValue({}, {}, 'binanceUid')).toBe('');
  });
  it('hides legacy double-quote junk saved by the old bug', () => {
    expect(displaySettingValue({}, { binanceUid: '""' }, 'binanceUid')).toBe('');
    expect(displaySettingValue({}, { binanceUid: "''" }, 'binanceUid')).toBe('');
  });
  it('shows plain strings as-is', () => {
    expect(displaySettingValue({}, { supportUrl: 'https://t.me/x' }, 'supportUrl')).toBe('https://t.me/x');
  });
  it('never shows the secret mask inside an input', () => {
    expect(displaySettingValue({}, { binanceSpotSecret: '••••••' }, 'binanceSpotSecret')).toBe('');
  });
  it('stringifies numbers, booleans and objects', () => {
    expect(displaySettingValue({}, { referralPercent: 5 }, 'referralPercent')).toBe('5');
    expect(displaySettingValue({}, { manualAddresses: { TRC20: 'a' } }, 'manualAddresses')).toBe('{"TRC20":"a"}');
  });
  it('form edits win over server values', () => {
    expect(displaySettingValue({ binanceUid: '123' }, { binanceUid: '999' }, 'binanceUid')).toBe('123');
  });
});

describe('secretPlaceholder', () => {
  it('tells the user blank keeps the saved key', () => {
    expect(secretPlaceholder('••••••')).toContain('leave blank to keep');
    expect(secretPlaceholder('')).toBe('Paste new value…');
  });
});

describe('shouldSkipSecret', () => {
  it('skips blank and masked secrets, sends real ones', () => {
    expect(shouldSkipSecret('binanceSpotSecret', '')).toBe(true);
    expect(shouldSkipSecret('binanceSpotSecret', '••••••')).toBe(true);
    expect(shouldSkipSecret('binanceSpotSecret', 'new-key')).toBe(false);
    expect(shouldSkipSecret('binanceUid', '')).toBe(false);
  });
});

describe('normalizeSettingInput', () => {
  it('drops legacy quote junk, keeps real values', () => {
    expect(normalizeSettingInput('""')).toBe('');
    expect(normalizeSettingInput("''")).toBe('');
    expect(normalizeSettingInput('1134278389')).toBe('1134278389');
  });
});
