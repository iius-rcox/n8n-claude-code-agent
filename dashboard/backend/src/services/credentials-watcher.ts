import { watch, FSWatcher } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { TokenRefreshService } from './token-refresh.js';

export class CredentialsWatcherService {
  private watcher: FSWatcher | null = null;
  private credentialsPath: string;
  private settingsPath: string;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_MS = 1000; // Wait 1 second after file change

  constructor(private tokenRefreshService: TokenRefreshService) {
    const claudeDir = join(homedir(), '.claude');
    this.credentialsPath = join(claudeDir, '.credentials.json');
    this.settingsPath = join(claudeDir, 'settings.json');
  }

  start(): void {
    if (this.watcher) {
      return; // Already watching
    }

    const claudeDir = join(homedir(), '.claude');

    try {
      this.watcher = watch(claudeDir, (eventType, filename) => {
        if (filename === '.credentials.json' && eventType === 'change') {
          this.handleCredentialsChange();
        }
      });

      console.log(`Watching for credential changes in ${claudeDir}`);
    } catch (error) {
      console.error('Failed to start credentials watcher:', error);
    }
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private handleCredentialsChange(): void {
    // Debounce to avoid multiple triggers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      await this.pushCredentialsIfPending();
    }, this.DEBOUNCE_MS);
  }

  private async pushCredentialsIfPending(): Promise<void> {
    // Check if there's a pending operation
    const pendingOp = this.tokenRefreshService.getPendingOperation();
    if (!pendingOp) {
      console.log('Credentials file changed but no pending refresh operation');
      return;
    }

    console.log('Credentials file changed, pushing to pending operation...');

    try {
      // Read the credentials and settings files
      const [credentials, settings] = await Promise.all([
        readFile(this.credentialsPath, 'utf-8'),
        readFile(this.settingsPath, 'utf-8'),
      ]);

      // Validate and push
      const push = { credentials, settings };
      const validation = this.tokenRefreshService.validateCredentials(push);

      if (!validation.valid) {
        console.error('Invalid credentials:', validation.errors);
        return;
      }

      // Execute the refresh
      await this.tokenRefreshService.executeRefresh(pendingOp.id, push);
      console.log('Credentials pushed successfully');
    } catch (error) {
      console.error('Failed to push credentials:', error);
    }
  }
}
