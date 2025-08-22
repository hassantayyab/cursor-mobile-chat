#!/usr/bin/env node
import { CursorDataNormalizer } from '@cursor-mobile-chat/extractor';
import { Command } from 'commander';
import { config } from 'dotenv';

// Load environment variables
config();

const program = new Command();

program
  .name('cursor-companion')
  .description('Desktop companion for Cursor Mobile Chat')
  .version('0.1.0');

program
  .command('extract')
  .description('Extract data from Cursor databases once')
  .option('--dry', 'Print data to console without sending to server')
  .option('--server-url <url>', 'Server URL to send data to')
  .option('--token <token>', 'Authentication token')
  .action(async options => {
    console.log('🔍 Extracting Cursor chat data...');

    try {
      const normalizer = new CursorDataNormalizer({
        enableChatData: true,
        enableComposer: true,
        preferComposer: true,
      });

      const results = await normalizer.normalizeAllDatabases();

      if (options.dry) {
        console.log('📊 Extraction Results:');
        for (const result of results) {
          console.log(`\nDatabase: ${result.metadata.databasePath}`);
          console.log(`Workspace: ${result.metadata.workspaceId}`);
          console.log(`Threads: ${result.threads.length}`);
          console.log(`Messages: ${result.messages.length}`);
          console.log(`Adapters: ${result.metadata.adaptersUsed.join(', ')}`);
        }
      } else {
        // TODO: Send data to server
        console.log('🚀 Sending data to server...');
        console.log('⚠️  Server sync not implemented yet');
      }
    } catch (error) {
      console.error('❌ Failed to extract data:', error);
      process.exit(1);
    }
  });

program
  .command('watch')
  .description('Watch Cursor databases for changes and sync continuously')
  .option('--server-url <url>', 'Server URL to send data to')
  .option('--token <token>', 'Authentication token')
  .option('--interval <ms>', 'Watch interval in milliseconds', '5000')
  .action(async options => {
    console.log('👁️  Watching Cursor databases for changes...');
    console.log('⚠️  Watch mode not implemented yet');

    // TODO: Implement file watching with chokidar
    // TODO: Implement incremental sync

    process.exit(0);
  });

program.parse();
