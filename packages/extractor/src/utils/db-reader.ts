import Database from 'better-sqlite3';
import { copyFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { CursorPathDiscovery } from './paths.js';

/**
 * Safe SQLite database reader that copies DB files before accessing them
 */
export class SafeDbReader {
  private db: Database.Database | null = null;
  private tempDir: string | null = null;
  private tempDbPath: string | null = null;

  constructor(private originalDbPath: string) {}

  /**
   * Open database safely by copying to temp location first
   */
  async open(): Promise<void> {
    if (this.db) {
      throw new Error('Database is already open');
    }

    try {
      // Create temporary directory
      this.tempDir = mkdtempSync(join(tmpdir(), 'cursor-db-'));
      this.tempDbPath = join(this.tempDir, 'state.vscdb');

      // Copy all related database files (main, WAL, SHM)
      const dbFiles = CursorPathDiscovery.getDatabaseFiles(this.originalDbPath);
      
      for (const file of dbFiles) {
        const filename = file.split(/[/\\]/).pop()!;
        const tempFilePath = join(this.tempDir, filename);
        copyFileSync(file, tempFilePath);
      }

      // Open database in read-only mode
      this.db = new Database(this.tempDbPath, {
        readonly: true,
        fileMustExist: true,
      });

      // Enable WAL mode checkpoint to ensure we get all data
      this.db.pragma('wal_checkpoint(FULL)');
    } catch (error) {
      this.cleanup();
      throw new Error(`Failed to open database safely: ${error}`);
    }
  }

  /**
   * Execute a query and return results
   */
  query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) {
      throw new Error('Database is not open');
    }

    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(params) as T[];
    } catch (error) {
      throw new Error(`Query failed: ${error}`);
    }
  }

  /**
   * Get a single row from query
   */
  queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const results = this.query<T>(sql, params);
    return results[0] || null;
  }

  /**
   * Get all keys and values from ItemTable (Cursor's key-value store)
   */
  getAllItems(): Array<{ key: string; value: string }> {
    return this.query(
      'SELECT key, value FROM ItemTable WHERE key IS NOT NULL AND value IS NOT NULL'
    );
  }

  /**
   * Get specific keys from ItemTable
   */
  getItemsByKeys(keys: string[]): Array<{ key: string; value: string }> {
    if (keys.length === 0) return [];
    
    const placeholders = keys.map(() => '?').join(',');
    return this.query(
      `SELECT key, value FROM ItemTable WHERE key IN (${placeholders})`,
      keys
    );
  }

  /**
   * Get keys matching a pattern
   */
  getItemsByPattern(pattern: string): Array<{ key: string; value: string }> {
    return this.query(
      'SELECT key, value FROM ItemTable WHERE key LIKE ?',
      [pattern]
    );
  }

  /**
   * Get database metadata
   */
  getMetadata() {
    const tableInfo = this.query("SELECT name FROM sqlite_master WHERE type='table'");
    const dbVersion = this.queryOne("PRAGMA user_version");
    const dbSize = this.queryOne("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()");
    
    return {
      tables: tableInfo.map(t => t.name),
      version: dbVersion?.user_version || 0,
      size: dbSize?.size || 0,
      originalPath: this.originalDbPath,
      tempPath: this.tempDbPath,
    };
  }

  /**
   * Close database and cleanup temporary files
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.cleanup();
  }

  /**
   * Cleanup temporary files
   */
  private cleanup(): void {
    if (this.tempDir) {
      try {
        rmSync(this.tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to cleanup temp directory ${this.tempDir}:`, error);
      }
      this.tempDir = null;
      this.tempDbPath = null;
    }
  }

  /**
   * Ensure cleanup happens even if close() wasn't called
   */
  [Symbol.dispose](): void {
    this.close();
  }
}
