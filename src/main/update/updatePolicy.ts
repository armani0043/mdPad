export interface UpdateRuntime {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  isOnline: boolean;
  isPortable: boolean;
  isSmokeTest: boolean;
}

/**
 * Updates are intentionally limited to an installed Windows build with an
 * already-available connection. No connectivity probe or prompt is performed.
 */
export function shouldCheckForUpdates(runtime: UpdateRuntime): boolean {
  return (
    runtime.isPackaged &&
    runtime.platform === 'win32' &&
    runtime.isOnline &&
    !runtime.isPortable &&
    !runtime.isSmokeTest
  );
}

export function isPortableEnvironment(environment: NodeJS.ProcessEnv): boolean {
  return Boolean(
    environment.PORTABLE_EXECUTABLE_FILE ||
    environment.PORTABLE_EXECUTABLE_DIR ||
    environment.PORTABLE_EXECUTABLE_APP_FILENAME,
  );
}

export function displayUpdateVersion(value: string): string {
  const trimmed = value.trim();
  return /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(trimmed)
    ? trimmed.slice(0, 64)
    : 'new version';
}

export function updateProgressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
