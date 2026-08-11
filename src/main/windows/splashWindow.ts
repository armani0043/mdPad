import { join } from 'node:path';
import { app, BrowserWindow, nativeImage } from 'electron';

function applicationIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '../../resources/icon.png');
}

function splashMarkup(iconDataUrl: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Starting mdPad</title>
    <style>
      * { box-sizing: border-box; }
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
      body {
        color: #17233c;
        background:
          radial-gradient(circle at 50% 12%, rgba(57, 142, 255, 0.13), transparent 43%),
          linear-gradient(145deg, #ffffff 0%, #f6f9ff 100%);
        font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
        user-select: none;
      }
      main {
        position: relative;
        display: flex;
        width: 100%;
        height: 100%;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(54, 93, 155, 0.16);
      }
      .logo {
        width: 88px;
        height: 88px;
        margin-bottom: 13px;
        object-fit: contain;
        filter: drop-shadow(0 10px 18px rgba(10, 101, 223, 0.2));
      }
      h1 { margin: 0; font-size: 28px; line-height: 1.15; letter-spacing: -0.5px; }
      .tagline { margin: 8px 0 30px; color: #64718a; font-size: 13px; }
      .progress {
        width: 160px;
        height: 3px;
        overflow: hidden;
        border-radius: 999px;
        background: #dce8fa;
      }
      .progress span {
        display: block;
        width: 44%;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #0877f9, #43a8ff);
        animation: loading 1.05s ease-in-out infinite;
      }
      footer {
        position: absolute;
        right: 18px;
        bottom: 14px;
        left: 18px;
        color: #7a869c;
        font-size: 11px;
      }
      @keyframes loading {
        0% { transform: translateX(-110%); }
        100% { transform: translateX(335%); }
      }
    </style>
  </head>
  <body>
    <main>
      <img class="logo" src="${iconDataUrl}" alt="mdPad" />
      <h1>mdPad</h1>
      <p class="tagline">A clear, private desktop home for Markdown.</p>
      <div class="progress" aria-label="Loading"><span></span></div>
      <footer>Starting mdPad…</footer>
    </main>
  </body>
</html>`;
}

/** Create the short-lived window shown while the main editor is loading. */
export function createSplashWindow(): BrowserWindow {
  const iconPath = applicationIconPath();
  const iconDataUrl = nativeImage.createFromPath(iconPath).toDataURL();
  const splash = new BrowserWindow({
    width: 470,
    height: 320,
    useContentSize: true,
    center: true,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    hasShadow: true,
    backgroundColor: '#f8faff',
    title: 'Starting mdPad',
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  splash.setMenuBarVisibility(false);
  splash.once('ready-to-show', () => {
    if (!splash.isDestroyed()) splash.show();
  });
  splash.webContents.on('will-navigate', (event) => event.preventDefault());
  splash.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  void splash.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(splashMarkup(iconDataUrl))}`,
  );

  return splash;
}
