import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileAccessRegistry } from '../src/main/ipc/fileAccess';

describe('FileAccessRegistry', () => {
  it('allows only paths granted to the same renderer', () => {
    const access = new FileAccessRegistry();
    const granted = path.resolve('notes', 'granted.md');
    const other = path.resolve('notes', 'other.md');

    expect(access.authorize(1, granted)).toBe(path.normalize(granted));
    expect(access.assertAuthorized(1, granted)).toBe(path.normalize(granted));
    expect(() => access.assertAuthorized(1, other)).toThrowError(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
    expect(() => access.assertAuthorized(2, granted)).toThrowError(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
  });

  it('revokes all grants when a renderer is destroyed', () => {
    const access = new FileAccessRegistry();
    const granted = path.resolve('notes', 'granted.md');
    access.authorize(7, granted);
    access.revokeAll(7);
    expect(() => access.assertAuthorized(7, granted)).toThrowError(
      expect.objectContaining({ code: 'PERMISSION_DENIED' }) as Error,
    );
  });
});
