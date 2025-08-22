import { createHash } from 'crypto';

/**
 * Generate a stable hash ID from multiple string inputs
 */
export const generateStableId = (...inputs: string[]): string => {
  const combined = inputs.join('|');
  return createHash('sha256').update(combined).digest('hex').substring(0, 16);
};

/**
 * Extract code blocks from markdown-style content
 */
export const extractCodeBlocks = (content: string) => {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      content: match[2]?.trim() || '',
    });
  }

  return blocks;
};

/**
 * Sanitize content by removing potential secrets/sensitive data
 */
export const sanitizeContent = (content: string): string => {
  // Basic regex patterns for common secrets
  const patterns = [
    /(?:api[_-]?key|apikey|secret|token|password|pass|pwd)["\s]*[:=]["\s]*([a-zA-Z0-9_\-/+]{8,})/gi,
    /(?:bearer|authorization)["\s]*[:=]["\s]*([a-zA-Z0-9_\-/+.]{8,})/gi,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // emails
  ];

  let sanitized = content;
  patterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, match => {
      return match.replace(/[a-zA-Z0-9]/g, '*');
    });
  });

  return sanitized;
};

/**
 * Debounce function to limit how often a function can be called
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
};

/**
 * Sleep function for async operations
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Exponential backoff for retry logic
 */
export const exponentialBackoff = (attempt: number, maxDelay = 30000): number => {
  const delay = Math.min(Math.pow(2, attempt) * 1000, maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
};

/**
 * Safe JSON parse with fallback
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

/**
 * Truncate string with ellipsis
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
};

/**
 * Format timestamp to relative time
 */
export const formatRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;

  const minute = 60 * 1000;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30;
  const year = day * 365;

  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;
  if (diff < month) return `${Math.floor(diff / week)}w ago`;
  if (diff < year) return `${Math.floor(diff / month)}mo ago`;
  return `${Math.floor(diff / year)}y ago`;
};
