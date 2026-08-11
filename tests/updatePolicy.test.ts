import { describe, expect, it } from 'vitest';
import {
  displayUpdateVersion,
  isPortableEnvironment,
  shouldCheckForUpdates,
  updateProgressPercent,
} from '../src/main/update/updatePolicy';

const INSTALLED_ONLINE = {
  isPackaged: true,
  platform: 'win32',
  isOnline: true,
  isPortable: false,
  isSmokeTest: false,
} as const;

describe('silent update policy', () => {
  it('checks only an installed, packaged Windows app with an existing connection', () => {
    expect(shouldCheckForUpdates(INSTALLED_ONLINE)).toBe(true);
    expect(shouldCheckForUpdates({ ...INSTALLED_ONLINE, isOnline: false })).toBe(false);
    expect(shouldCheckForUpdates({ ...INSTALLED_ONLINE, isPortable: true })).toBe(false);
    expect(shouldCheckForUpdates({ ...INSTALLED_ONLINE, isPackaged: false })).toBe(false);
    expect(shouldCheckForUpdates({ ...INSTALLED_ONLINE, isSmokeTest: true })).toBe(false);
    expect(shouldCheckForUpdates({ ...INSTALLED_ONLINE, platform: 'darwin' })).toBe(false);
  });

  it('detects electron-builder portable launches without network activity', () => {
    expect(isPortableEnvironment({ PORTABLE_EXECUTABLE_FILE: 'mdPad-Portable.exe' })).toBe(true);
    expect(isPortableEnvironment({})).toBe(false);
  });

  it('sanitizes update display data', () => {
    expect(displayUpdateVersion(' 1.2.3 ')).toBe('1.2.3');
    expect(displayUpdateVersion('<script>')).toBe('new version');
    expect(updateProgressPercent(-4)).toBe(0);
    expect(updateProgressPercent(57.6)).toBe(58);
    expect(updateProgressPercent(140)).toBe(100);
  });
});
