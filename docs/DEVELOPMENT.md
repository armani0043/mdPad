# Development and release

## Prerequisites

- Windows 10/11 x64 for the supported release target.
- Node.js 22.12+ (verified with 22.23.1) and npm 10+ (verified with 10.9.8).
- Internet access is needed only to install/build dependencies; the packaged editor works offline.

Electron 43 embeds Node.js 24, so `@types/node` 24 is used for main-process runtime typing.

## Install, run, and verify

```powershell
npm install
npm run dev
npm run check
```

`npm run check` executes formatting verification, strict main/renderer typechecks, ESLint, all
Vitest suites, and a production bundle. Tests use OS temporary directories and never touch user
documents. The Visual Mode suite uses happy-dom only as a test environment.

## Windows packaging

```powershell
npm run pack:win   # release/win-unpacked/mdPad.exe
npm run dist:win   # NSIS Setup EXE + portable EXE
```

The installer is per-user, supports a chosen installation directory, creates Start Menu/Desktop
shortcuts, and keeps app/recovery data when uninstalled. The portable artifact needs no installer.

Release checklist:

1. Run `npm ci` and `npm audit` on a clean machine.
2. Run `npm run check` and the real Electron UI smoke test.
3. Run `npm run dist:win` and smoke-launch `release/win-unpacked/mdPad.exe` or the portable EXE.
4. Record file sizes and SHA-256 hashes.
5. Verify fully offline with a representative workspace, save, preview, search, attachment paste,
   restart/restore, and export. Confirm startup remains silent with the network disconnected.
6. Upload the setup EXE, its blockmap, and `latest.yml` from the same build to the public GitHub
   Release; never mix update metadata and installers from different builds.
7. Before public distribution, add Authenticode signing and ship complete Electron/Chromium and npm
   third-party notices. Unsigned internal builds can trigger SmartScreen.

## File-safety rules

- Never write an untouched existing document.
- Preserve BOM and LF/CRLF metadata and document unavoidable normalization.
- Snapshot content before asynchronous saves and mark only that snapshot saved.
- Never expose renderer filesystem or generic IPC access.
- Keep authorization, canonicalization, mutation, and export in the main process.
- Add regression coverage before changing serialization, conflict, recovery, or path behavior.

Use npm only; `package-lock.json` is authoritative. New dependencies require maintenance,
Electron-compatibility, native-binary, and commercial-license review plus updates to dependency and
license documentation.
