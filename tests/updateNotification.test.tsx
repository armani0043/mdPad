/** @vitest-environment happy-dom */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopAPI } from '../src/shared/types/desktopApi';
import type { UpdateState } from '../src/shared/types';
import { UpdateNotification } from '../src/renderer/src/components/UpdateNotification';
import { useDocumentStore } from '../src/renderer/src/stores/documentStore';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('optional update notification', () => {
  let container: HTMLDivElement;
  let root: Root;
  let updateListener: ((state: UpdateState) => void) | null;
  const downloadUpdate = vi.fn(async () => true);
  const installUpdate = vi.fn(async () => true);

  beforeEach(() => {
    updateListener = null;
    downloadUpdate.mockClear();
    installUpdate.mockClear();
    useDocumentStore.setState({ documents: [], activeDocumentId: null });
    window.desktopAPI = {
      getUpdateState: async () => ({ phase: 'idle' }),
      onUpdateState: (listener) => {
        updateListener = listener;
        return () => {
          updateListener = null;
        };
      },
      downloadUpdate,
      installUpdate,
    } as unknown as DesktopAPI;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('stays hidden until an update exists and keeps every action optional', async () => {
    await act(async () => {
      root.render(<UpdateNotification />);
      await Promise.resolve();
    });
    expect(container.textContent).toBe('');

    act(() => updateListener?.({ phase: 'available', version: '1.2.3' }));
    expect(container.textContent).toContain('mdPad 1.2.3 is available');

    const downloadButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Download update'),
    );
    act(() => downloadButton?.click());
    expect(downloadUpdate).toHaveBeenCalledOnce();

    act(() => updateListener?.({ phase: 'downloading', version: '1.2.3', percent: 42 }));
    expect(container.textContent).toContain('42%');
    expect(container.textContent).toContain('keep working');

    const hideProgress = container.querySelector<HTMLButtonElement>(
      'button[title="Hide update progress"]',
    );
    act(() => hideProgress?.click());
    expect(container.textContent).toBe('');

    act(() => updateListener?.({ phase: 'ready', version: '1.2.3' }));
    expect(container.textContent).toContain('ready to install');
    const installButton = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Install and restart'),
    );
    act(() => installButton?.click());
    expect(installUpdate).toHaveBeenCalledOnce();
  });

  it('postpones the notice without installing anything', async () => {
    await act(async () => {
      root.render(<UpdateNotification />);
      await Promise.resolve();
    });
    act(() => updateListener?.({ phase: 'available', version: '2.0.0' }));
    const laterButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Later',
    );
    act(() => laterButton?.click());

    expect(container.textContent).toBe('');
    expect(downloadUpdate).not.toHaveBeenCalled();
    expect(installUpdate).not.toHaveBeenCalled();
  });
});
