import type { Message, Thread } from '@cursor-mobile-chat/shared';
import equal from 'fast-deep-equal';
import { ChatDataAdapter } from './adapters/chatdata.js';
import { ComposerAdapter } from './adapters/composer.js';
import { SafeDbReader } from './utils/db-reader.js';
import { CursorPathDiscovery } from './utils/paths.js';

/**
 * Configuration for the normalizer
 */
export interface NormalizerOptions {
  /**
   * Enable chatdata adapter (older format)
   */
  enableChatData: boolean;
  
  /**
   * Enable composer adapter (newer format)  
   */
  enableComposer: boolean;
  
  /**
   * Prefer composer over chatdata when both have data
   */
  preferComposer: boolean;
  
  /**
   * Maximum number of threads to extract per database
   */
  maxThreadsPerDb?: number;
  
  /**
   * Maximum number of messages per thread
   */
  maxMessagesPerThread?: number;
}

/**
 * Result of normalization process
 */
export interface NormalizationResult {
  threads: Thread[];
  messages: Message[];
  metadata: {
    databasePath: string;
    workspaceId: string;
    extractedAt: number;
    adaptersUsed: string[];
    totalThreads: number;
    totalMessages: number;
  };
}

/**
 * Main normalizer that coordinates adapters to extract and normalize Cursor chat data
 */
export class CursorDataNormalizer {
  private defaultOptions: NormalizerOptions = {
    enableChatData: true,
    enableComposer: true,
    preferComposer: true,
    maxThreadsPerDb: 1000,
    maxMessagesPerThread: 1000,
  };

  constructor(private options: Partial<NormalizerOptions> = {}) {}

  /**
   * Normalize data from a single database file
   */
  async normalizeDatabase(dbPath: string): Promise<NormalizationResult> {
    const options = { ...this.defaultOptions, ...this.options };
    const workspaceId = CursorPathDiscovery.getWorkspaceIdentifier(dbPath) || 'unknown';
    const adaptersUsed: string[] = [];
    
    let allThreads: Thread[] = [];
    let allMessages: Message[] = [];

    const dbReader = new SafeDbReader(dbPath);
    
    try {
      await dbReader.open();

      // Try composer adapter first if preferred
      if (options.enableComposer) {
        const composerAdapter = new ComposerAdapter(dbReader, workspaceId);
        const composerResult = composerAdapter.extract();
        
        if (composerResult.threads.length > 0) {
          allThreads.push(...composerResult.threads);
          allMessages.push(...composerResult.messages);
          adaptersUsed.push('composer');
        }
      }

      // Try chatdata adapter if enabled and (no composer data or not preferred)
      if (options.enableChatData && (!options.preferComposer || allThreads.length === 0)) {
        const chatDataAdapter = new ChatDataAdapter(dbReader, workspaceId);
        const chatDataResult = chatDataAdapter.extract();
        
        if (chatDataResult.threads.length > 0) {
          // If we prefer composer and already have data, merge; otherwise replace
          if (options.preferComposer && allThreads.length > 0) {
            // Merge unique threads (avoid duplicates)
            const existingThreadIds = new Set(allThreads.map(t => t.id));
            const newThreads = chatDataResult.threads.filter(t => !existingThreadIds.has(t.id));
            const newMessages = chatDataResult.messages.filter(m => 
              newThreads.some(t => t.id === m.threadId)
            );
            
            allThreads.push(...newThreads);
            allMessages.push(...newMessages);
          } else if (allThreads.length === 0) {
            // No composer data, use chatdata
            allThreads = chatDataResult.threads;
            allMessages = chatDataResult.messages;
          }
          
          if (!adaptersUsed.includes('chatdata')) {
            adaptersUsed.push('chatdata');
          }
        }
      }

      // Apply limits
      if (options.maxThreadsPerDb && allThreads.length > options.maxThreadsPerDb) {
        // Sort by updatedAt descending and take the most recent
        allThreads.sort((a, b) => b.updatedAt - a.updatedAt);
        allThreads = allThreads.slice(0, options.maxThreadsPerDb);
        
        // Filter messages to only include those from kept threads
        const keptThreadIds = new Set(allThreads.map(t => t.id));
        allMessages = allMessages.filter(m => keptThreadIds.has(m.threadId));
      }

      if (options.maxMessagesPerThread) {
        // Group messages by thread and limit each thread
        const messagesByThread = new Map<string, Message[]>();
        
        for (const message of allMessages) {
          if (!messagesByThread.has(message.threadId)) {
            messagesByThread.set(message.threadId, []);
          }
          messagesByThread.get(message.threadId)!.push(message);
        }

        // Sort messages within each thread by timestamp and apply limit
        allMessages = [];
        for (const [threadId, messages] of messagesByThread) {
          messages.sort((a, b) => a.timestamp - b.timestamp);
          const limitedMessages = messages.slice(0, options.maxMessagesPerThread);
          allMessages.push(...limitedMessages);
          
          // Update thread message count
          const thread = allThreads.find(t => t.id === threadId);
          if (thread) {
            thread.messageCount = limitedMessages.length;
            if (limitedMessages.length > 0) {
              thread.lastMessage = limitedMessages[limitedMessages.length - 1].content.substring(0, 100);
            }
          }
        }
      }

      return {
        threads: allThreads,
        messages: allMessages,
        metadata: {
          databasePath: dbPath,
          workspaceId,
          extractedAt: Date.now(),
          adaptersUsed,
          totalThreads: allThreads.length,
          totalMessages: allMessages.length,
        },
      };

    } finally {
      dbReader.close();
    }
  }

  /**
   * Normalize data from all discoverable databases
   */
  async normalizeAllDatabases(): Promise<NormalizationResult[]> {
    const dbPaths = await CursorPathDiscovery.findStateDatabases();
    const results: NormalizationResult[] = [];

    for (const dbPath of dbPaths) {
      try {
        const result = await this.normalizeDatabase(dbPath);
        if (result.threads.length > 0) {
          results.push(result);
        }
      } catch (error) {
        console.error(`Failed to normalize database ${dbPath}:`, error);
      }
    }

    return results;
  }

  /**
   * Check if two normalization results have the same data (for diffing)
   */
  static isEqual(a: NormalizationResult, b: NormalizationResult): boolean {
    return equal(a.threads, b.threads) && equal(a.messages, b.messages);
  }

  /**
   * Compute diff between two normalization results
   */
  static diff(
    previous: NormalizationResult | null, 
    current: NormalizationResult
  ): { newThreads: Thread[]; newMessages: Message[]; updatedThreads: Thread[] } {
    if (!previous) {
      return {
        newThreads: current.threads,
        newMessages: current.messages,
        updatedThreads: [],
      };
    }

    const prevThreadIds = new Set(previous.threads.map(t => t.id));
    const prevMessageIds = new Set(previous.messages.map(m => m.id));
    
    const newThreads = current.threads.filter(t => !prevThreadIds.has(t.id));
    const newMessages = current.messages.filter(m => !prevMessageIds.has(m.id));
    
    // Find updated threads (same ID but different data)
    const updatedThreads: Thread[] = [];
    for (const currentThread of current.threads) {
      const prevThread = previous.threads.find(t => t.id === currentThread.id);
      if (prevThread && !equal(prevThread, currentThread)) {
        updatedThreads.push(currentThread);
      }
    }

    return { newThreads, newMessages, updatedThreads };
  }
}
