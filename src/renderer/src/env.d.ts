/// <reference types="vite/client" />
import type { DesktopAPI } from '../../shared/types/desktopApi';

declare global {
  interface Window {
    desktopAPI: DesktopAPI;
  }
}

export {};
