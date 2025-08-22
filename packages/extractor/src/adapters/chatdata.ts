import type { Message, Thread } from '@cursor-mobile-chat/shared';
import { extractCodeBlocks, generateStableId, safeJsonParse } from '@cursor-mobile-chat/shared';
import type { SafeDbReader } from '../utils/db-reader.js';

/**
 * Adapter for the older chatdata format stored in Cursor databases
 * Handles keys like 'workbench.panel.aichat.view.aichat.chatdata' and 'aiService.prompts'
 */
export class ChatDataAdapter {
  constructor(private dbReader: SafeDbReader, private workspaceId: string) {}

  /**
   * Extract threads and messages from the chatdata format
   */
  extract(): { threads: Thread[]; messages: Message[] } {
    const threads: Thread[] = [];
    const messages: Message[] = [];

    // Get chatdata entries
    const chatDataKeys = [
      'workbench.panel.aichat.view.aichat.chatdata',
      'aiService.prompts',
    ];

    const items = this.dbReader.getItemsByKeys(chatDataKeys);

    for (const item of items) {
      try {
        const data = safeJsonParse(item.value, null);
        if (!data) continue;

        if (item.key === 'workbench.panel.aichat.view.aichat.chatdata') {
          const result = this.extractFromChatData(data);
          threads.push(...result.threads);
          messages.push(...result.messages);
        } else if (item.key === 'aiService.prompts') {
          const result = this.extractFromPrompts(data);
          threads.push(...result.threads);
          messages.push(...result.messages);
        }
      } catch (error) {
        console.warn(`Failed to parse ${item.key}:`, error);
      }
    }

    return { threads, messages };
  }

  /**
   * Extract from chatdata structure
   */
  private extractFromChatData(data: any): { threads: Thread[]; messages: Message[] } {
    const threads: Thread[] = [];
    const messages: Message[] = [];

    // Handle different possible structures
    if (Array.isArray(data)) {
      // Array of chat sessions
      for (let i = 0; i < data.length; i++) {
        const result = this.extractChatSession(data[i], i);
        if (result) {
          threads.push(result.thread);
          messages.push(...result.messages);
        }
      }
    } else if (data.conversations || data.chats) {
      // Object with conversations/chats array
      const chatArray = data.conversations || data.chats;
      if (Array.isArray(chatArray)) {
        for (let i = 0; i < chatArray.length; i++) {
          const result = this.extractChatSession(chatArray[i], i);
          if (result) {
            threads.push(result.thread);
            messages.push(...result.messages);
          }
        }
      }
    } else if (data.messages || data.history) {
      // Single conversation with messages/history
      const result = this.extractChatSession(data, 0);
      if (result) {
        threads.push(result.thread);
        messages.push(...result.messages);
      }
    }

    return { threads, messages };
  }

  /**
   * Extract from prompts structure
   */
  private extractFromPrompts(data: any): { threads: Thread[]; messages: Message[] } {
    const threads: Thread[] = [];
    const messages: Message[] = [];

    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        const prompt = data[i];
        const result = this.extractFromPrompt(prompt, i);
        if (result) {
          threads.push(result.thread);
          messages.push(...result.messages);
        }
      }
    }

    return { threads, messages };
  }

  /**
   * Extract a single chat session
   */
  private extractChatSession(session: any, index: number): { thread: Thread; messages: Message[] } | null {
    if (!session) return null;

    const sessionMessages = session.messages || session.history || session.entries || [];
    if (!Array.isArray(sessionMessages) || sessionMessages.length === 0) {
      return null;
    }

    // Generate stable thread ID
    const threadId = generateStableId(
      this.workspaceId,
      'chatdata',
      String(index),
      String(sessionMessages[0]?.timestamp || Date.now())
    );

    // Extract messages
    const messages: Message[] = [];
    let lastMessage = '';
    
    for (let msgIndex = 0; msgIndex < sessionMessages.length; msgIndex++) {
      const msg = sessionMessages[msgIndex];
      const message = this.extractMessage(msg, threadId, msgIndex);
      if (message) {
        messages.push(message);
        lastMessage = message.content.substring(0, 100);
      }
    }

    if (messages.length === 0) return null;

    // Create thread
    const thread: Thread = {
      id: threadId,
      title: this.generateThreadTitle(messages[0]),
      workspaceId: this.workspaceId === '_global_' ? undefined : this.workspaceId,
      workspaceName: session.workspace || undefined,
      createdAt: messages[0]?.timestamp || Date.now(),
      updatedAt: messages[messages.length - 1]?.timestamp || Date.now(),
      messageCount: messages.length,
      lastMessage,
      metadata: {
        source: 'chatdata',
        originalIndex: index,
      },
    };

    return { thread, messages };
  }

  /**
   * Extract from a single prompt
   */
  private extractFromPrompt(prompt: any, index: number): { thread: Thread; messages: Message[] } | null {
    if (!prompt || !prompt.prompt) return null;

    const threadId = generateStableId(
      this.workspaceId,
      'prompts', 
      String(index),
      String(prompt.timestamp || Date.now())
    );

    const messages: Message[] = [];

    // Add user message
    const userMessage: Message = {
      id: generateStableId(threadId, 'user', String(0)),
      threadId,
      role: 'user',
      content: prompt.prompt,
      timestamp: prompt.timestamp || Date.now(),
      codeBlocks: extractCodeBlocks(prompt.prompt),
    };
    messages.push(userMessage);

    // Add response if available
    if (prompt.response) {
      const assistantMessage: Message = {
        id: generateStableId(threadId, 'assistant', String(1)),
        threadId,
        role: 'assistant',
        content: prompt.response,
        timestamp: (prompt.timestamp || Date.now()) + 1000, // Slightly later
        codeBlocks: extractCodeBlocks(prompt.response),
      };
      messages.push(assistantMessage);
    }

    // Create thread
    const thread: Thread = {
      id: threadId,
      title: this.generateThreadTitle(userMessage),
      workspaceId: this.workspaceId === '_global_' ? undefined : this.workspaceId,
      createdAt: userMessage.timestamp,
      updatedAt: messages[messages.length - 1]?.timestamp || userMessage.timestamp,
      messageCount: messages.length,
      lastMessage: messages[messages.length - 1]?.content.substring(0, 100) || '',
      metadata: {
        source: 'prompts',
        originalIndex: index,
      },
    };

    return { thread, messages };
  }

  /**
   * Extract a single message
   */
  private extractMessage(msg: any, threadId: string, index: number): Message | null {
    if (!msg) return null;

    const content = msg.content || msg.text || msg.message || '';
    if (!content) return null;

    const role = this.normalizeRole(msg.role || msg.type || msg.sender || 'user');
    
    return {
      id: generateStableId(threadId, role, String(index)),
      threadId,
      role,
      content,
      timestamp: msg.timestamp || msg.time || Date.now(),
      codeBlocks: extractCodeBlocks(content),
      metadata: {
        originalIndex: index,
        source: msg,
      },
    };
  }

  /**
   * Normalize message role to standard values
   */
  private normalizeRole(role: string): 'user' | 'assistant' | 'system' | 'tool' {
    const normalized = role.toLowerCase();
    
    if (normalized.includes('user') || normalized.includes('human')) return 'user';
    if (normalized.includes('assistant') || normalized.includes('ai') || normalized.includes('bot')) return 'assistant';
    if (normalized.includes('system')) return 'system';
    if (normalized.includes('tool') || normalized.includes('function')) return 'tool';
    
    return 'user'; // Default fallback
  }

  /**
   * Generate a thread title from the first message
   */
  private generateThreadTitle(firstMessage: Message): string {
    const content = firstMessage.content.trim();
    const firstLine = content.split('\n')[0];
    
    // Clean up the title
    let title = firstLine.replace(/^[#*>\-\s]+/, '').trim();
    
    // Truncate if too long
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    return title || 'Untitled Conversation';
  }
}
