import type { Message, Thread } from '@cursor-mobile-chat/shared';
import { extractCodeBlocks, generateStableId, safeJsonParse } from '@cursor-mobile-chat/shared';
import type { SafeDbReader } from '../utils/db-reader.js';

/**
 * Adapter for the newer composer format stored in Cursor databases
 * Handles keys like 'composerData:*' which contains the newer chat structure
 */
export class ComposerAdapter {
  constructor(private dbReader: SafeDbReader, private workspaceId: string) {}

  /**
   * Extract threads and messages from the composer format
   */
  extract(): { threads: Thread[]; messages: Message[] } {
    const threads: Thread[] = [];
    const messages: Message[] = [];

    // Get all composer data entries
    const composerItems = this.dbReader.getItemsByPattern('composerData:%');

    for (const item of composerItems) {
      try {
        const data = safeJsonParse(item.value, null);
        if (!data) continue;

        const composerId = this.extractComposerIdFromKey(item.key);
        const result = this.extractComposerData(data, composerId);
        
        if (result) {
          threads.push(result.thread);
          messages.push(...result.messages);
        }
      } catch (error) {
        console.warn(`Failed to parse composer data ${item.key}:`, error);
      }
    }

    return { threads, messages };
  }

  /**
   * Extract composer ID from key like 'composerData:abc123'
   */
  private extractComposerIdFromKey(key: string): string {
    const match = key.match(/composerData:(.+)/);
    return match?.[1] || 'unknown';
  }

  /**
   * Extract data from a composer entry
   */
  private extractComposerData(data: any, composerId: string): { thread: Thread; messages: Message[] } | null {
    if (!data) return null;

    // Handle different composer data structures
    const conversation = data.conversation || data.messages || data.history;
    const messages: Message[] = [];

    if (!conversation && data.prompt) {
      // Single prompt-response pair
      return this.extractSinglePrompt(data, composerId);
    }

    if (Array.isArray(conversation)) {
      // Array of messages
      for (let i = 0; i < conversation.length; i++) {
        const msg = conversation[i];
        const message = this.extractComposerMessage(msg, composerId, i);
        if (message) {
          messages.push(message);
        }
      }
    } else if (conversation && typeof conversation === 'object') {
      // Single conversation object
      const message = this.extractComposerMessage(conversation, composerId, 0);
      if (message) {
        messages.push(message);
      }
    }

    if (messages.length === 0) return null;

    // Generate stable thread ID
    const threadId = generateStableId(
      this.workspaceId,
      'composer',
      composerId,
      String(messages[0]?.timestamp || Date.now())
    );

    // Update message thread IDs
    messages.forEach(msg => {
      msg.threadId = threadId;
    });

    // Create thread
    const thread: Thread = {
      id: threadId,
      title: this.generateThreadTitle(data, messages[0]),
      workspaceId: this.workspaceId === '_global_' ? undefined : this.workspaceId,
      workspaceName: data.workspaceName || undefined,
      createdAt: messages[0]?.timestamp || data.createdAt || Date.now(),
      updatedAt: messages[messages.length - 1]?.timestamp || data.updatedAt || Date.now(),
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]?.content.substring(0, 100) || '',
      metadata: {
        source: 'composer',
        composerId,
        originalData: {
          title: data.title,
          tags: data.tags,
          starred: data.starred,
        },
      },
    };

    return { thread, messages };
  }

  /**
   * Extract a single prompt-response pair
   */
  private extractSinglePrompt(data: any, composerId: string): { thread: Thread; messages: Message[] } | null {
    const threadId = generateStableId(
      this.workspaceId,
      'composer',
      composerId,
      String(data.timestamp || Date.now())
    );

    const messages: Message[] = [];

    // User prompt
    if (data.prompt) {
      messages.push({
        id: generateStableId(threadId, 'user', '0'),
        threadId,
        role: 'user',
        content: data.prompt,
        timestamp: data.timestamp || Date.now(),
        codeBlocks: extractCodeBlocks(data.prompt),
      });
    }

    // Assistant response
    if (data.response) {
      messages.push({
        id: generateStableId(threadId, 'assistant', '1'),
        threadId,
        role: 'assistant',
        content: data.response,
        timestamp: (data.timestamp || Date.now()) + 1000,
        codeBlocks: extractCodeBlocks(data.response),
      });
    }

    if (messages.length === 0) return null;

    const thread: Thread = {
      id: threadId,
      title: this.generateThreadTitle(data, messages[0]),
      workspaceId: this.workspaceId === '_global_' ? undefined : this.workspaceId,
      createdAt: messages[0].timestamp,
      updatedAt: messages[messages.length - 1].timestamp,
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1].content.substring(0, 100),
      metadata: {
        source: 'composer',
        composerId,
      },
    };

    return { thread, messages };
  }

  /**
   * Extract a single composer message
   */
  private extractComposerMessage(msg: any, composerId: string, index: number): Message | null {
    if (!msg) return null;

    // Handle different message structures
    const content = msg.content || msg.text || msg.message || msg.prompt || msg.response || '';
    if (!content) return null;

    const role = this.normalizeRole(msg.role || msg.type || msg.sender || 'user');
    const timestamp = msg.timestamp || msg.createdAt || msg.time || Date.now();

    // Generate stable message ID
    const tempThreadId = generateStableId(this.workspaceId, 'composer', composerId);
    const messageId = generateStableId(tempThreadId, role, String(index));

    return {
      id: messageId,
      threadId: tempThreadId, // Will be updated later
      role,
      content,
      timestamp,
      codeBlocks: extractCodeBlocks(content),
      metadata: {
        originalIndex: index,
        composerId,
        source: msg,
        messageType: msg.messageType,
        contextFiles: msg.contextFiles,
        codebaseContexts: msg.codebaseContexts,
      },
    };
  }

  /**
   * Normalize message role to standard values
   */
  private normalizeRole(role: string): 'user' | 'assistant' | 'system' | 'tool' {
    if (!role) return 'user';
    
    const normalized = role.toLowerCase();
    
    if (normalized.includes('user') || normalized.includes('human')) return 'user';
    if (normalized.includes('assistant') || normalized.includes('ai') || normalized.includes('cursor')) return 'assistant';
    if (normalized.includes('system')) return 'system';
    if (normalized.includes('tool') || normalized.includes('function')) return 'tool';
    
    return 'user'; // Default fallback
  }

  /**
   * Generate a thread title from data or first message
   */
  private generateThreadTitle(data: any, firstMessage: Message): string {
    // Use explicit title if available
    if (data.title && typeof data.title === 'string' && data.title.trim()) {
      return data.title.trim();
    }

    // Generate from first message content
    const content = firstMessage.content.trim();
    const firstLine = content.split('\n')[0];
    
    // Clean up the title
    let title = firstLine.replace(/^[#*>\-\s]+/, '').trim();
    
    // Handle code blocks or file references
    if (title.startsWith('```')) {
      const lines = content.split('\n');
      for (let i = 1; i < lines.length && i < 5; i++) {
        if (lines[i] && !lines[i].startsWith('```')) {
          title = lines[i].trim();
          break;
        }
      }
    }
    
    // Truncate if too long
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    return title || 'New Conversation';
  }
}
