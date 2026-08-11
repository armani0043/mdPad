import { X } from 'lucide-react';
import logoUrl from '../../../../resources/icon.png';
import { useSettingsStore } from '../stores/settingsStore';
import { useWorkspaceStore } from '../stores/workspaceStore';

interface SettingsDialogProps {
  onClose(): void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps): React.JSX.Element {
  const settings = useSettingsStore();
  const update = settings.updateSettings;
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="settings-dialog" role="dialog" aria-modal="true" aria-label="Preferences">
        <header>
          <div className="settings-brand">
            <img src={logoUrl} alt="" />
            <div>
              <h2>Preferences</h2>
              <p>Stored locally on this computer.</p>
            </div>
          </div>
          <button title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="settings-content">
          <section>
            <h3>Appearance</h3>
            <label>
              Theme
              <select
                value={settings.theme}
                onChange={(event) => settings.setTheme(event.target.value as typeof settings.theme)}
              >
                <option value="system">Follow system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label>
              Editor font
              <select
                value={settings.fontFamily}
                onChange={(event) => update({ fontFamily: event.target.value })}
              >
                <option value="'Cascadia Code', Consolas, monospace">Cascadia / Consolas</option>
                <option value="Consolas, monospace">Consolas</option>
                <option value="'Courier New', monospace">Courier New</option>
                <option value="system-ui, sans-serif">System Sans</option>
                <option value="Georgia, serif">Georgia</option>
              </select>
            </label>
            <label>
              Editor font size <span>{settings.fontSize}px</span>
              <input
                type="range"
                min="11"
                max="32"
                value={settings.fontSize}
                onChange={(event) => update({ fontSize: Number(event.target.value) })}
              />
            </label>
            <label>
              Line height <span>{settings.lineHeight.toFixed(2)}</span>
              <input
                type="range"
                min="1.2"
                max="2.4"
                step="0.05"
                value={settings.lineHeight}
                onChange={(event) => update({ lineHeight: Number(event.target.value) })}
              />
            </label>
            <label>
              Reading width <span>{settings.contentWidth}px</span>
              <input
                type="range"
                min="560"
                max="1400"
                step="20"
                value={settings.contentWidth}
                onChange={(event) => update({ contentWidth: Number(event.target.value) })}
              />
            </label>
            <label className="check-setting">
              <input
                type="checkbox"
                checked={settings.wordWrap}
                onChange={(event) => update({ wordWrap: event.target.checked })}
              />
              Wrap long lines
            </label>
          </section>
          <section>
            <h3>Files and saving</h3>
            <label>
              Autosave
              <select
                value={settings.autosave}
                onChange={(event) =>
                  update({ autosave: event.target.value as typeof settings.autosave })
                }
              >
                <option value="off">Off</option>
                <option value="delay">After typing delay</option>
                <option value="blur">When editor loses focus</option>
              </select>
            </label>
            {settings.autosave === 'delay' && (
              <label>
                Autosave delay <span>{settings.autosaveDelay} ms</span>
                <input
                  type="range"
                  min="300"
                  max="5000"
                  step="100"
                  value={settings.autosaveDelay}
                  onChange={(event) => update({ autosaveDelay: Number(event.target.value) })}
                />
              </label>
            )}
            <label>
              Attachment folder
              <input
                type="text"
                value={settings.attachmentFolder}
                onChange={(event) =>
                  update({ attachmentFolder: event.target.value.replace(/^[/\\]+/, '') })
                }
              />
            </label>
            <label className="check-setting">
              <input
                type="checkbox"
                checked={settings.showAllFiles}
                onChange={(event) => {
                  update({ showAllFiles: event.target.checked });
                  setTimeout(() => void useWorkspaceStore.getState().refresh(), 0);
                }}
              />
              Show non-Markdown files in workspace
            </label>
            <label className="check-setting">
              <input
                type="checkbox"
                checked={settings.reopenLastWorkspace}
                onChange={(event) => update({ reopenLastWorkspace: event.target.checked })}
              />
              Reopen the last workspace at startup
            </label>
          </section>
          <section className="privacy-settings">
            <h3>Privacy</h3>
            <p>
              Your documents remain on your computer. mdPad does not require an account or cloud
              connection and core editing makes no network requests.
            </p>
          </section>
        </div>
        <footer>
          <button className="primary-button" onClick={onClose}>
            Done
          </button>
        </footer>
      </section>
    </div>
  );
}
