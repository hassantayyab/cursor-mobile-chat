import { existsSync } from 'fs';
import { glob } from 'glob';
import { homedir, platform } from 'os';
import { join } from 'path';

/**
 * Discover Cursor database paths across different operating systems
 */
export class CursorPathDiscovery {
  private static getBasePaths(): string[] {
    const os = platform();
    const home = homedir();

    switch (os) {
      case 'darwin': // macOS
        return [
          join(home, 'Library/Application Support/Cursor/User'),
        ];
      case 'win32': // Windows
        return [
          join(home, 'AppData/Roaming/Cursor/User'),
          join(home, 'AppData/Local/Cursor/User'),
        ];
      case 'linux': // Linux
        return [
          join(home, '.config/Cursor/User'),
        ];
      default:
        throw new Error(`Unsupported platform: ${os}`);
    }
  }

  /**
   * Find all Cursor state.vscdb files
   */
  static async findStateDatabases(): Promise<string[]> {
    const basePaths = this.getBasePaths();
    const databases: string[] = [];

    for (const basePath of basePaths) {
      if (!existsSync(basePath)) continue;

      try {
        // Search for state.vscdb files in globalStorage and workspaceStorage
        const patterns = [
          join(basePath, 'globalStorage/**/state.vscdb'),
          join(basePath, 'workspaceStorage/**/state.vscdb'),
        ];

        for (const pattern of patterns) {
          const files = await glob(pattern);
          databases.push(...files);
        }
      } catch (error) {
        console.warn(`Failed to search in ${basePath}:`, error);
      }
    }

    return databases;
  }

  /**
   * Get the workspace identifier from a database path
   */
  static getWorkspaceIdentifier(dbPath: string): string | null {
    // Extract workspace ID from path like:
    // .../workspaceStorage/1234567890abcdef/state.vscdb -> 1234567890abcdef
    const workspaceMatch = dbPath.match(/workspaceStorage[/\\]([^/\\]+)[/\\]/);
    if (workspaceMatch) {
      return workspaceMatch[1];
    }

    // For global storage, use a special identifier
    if (dbPath.includes('globalStorage')) {
      return '_global_';
    }

    return null;
  }

  /**
   * Check if database files are currently in use (has WAL or SHM files)
   */
  static isDatabaseInUse(dbPath: string): boolean {
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;

    return existsSync(walPath) || existsSync(shmPath);
  }

  /**
   * Get all related database files (main, WAL, SHM)
   */
  static getDatabaseFiles(dbPath: string): string[] {
    const files = [dbPath];
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;

    if (existsSync(walPath)) files.push(walPath);
    if (existsSync(shmPath)) files.push(shmPath);

    return files;
  }
}
