import { z } from 'zod';

// Core entity schemas
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system', 'tool']);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const CodeBlockSchema = z.object({
  language: z.string(),
  content: z.string(),
  filename: z.string().optional(),
});
export type CodeBlock = z.infer<typeof CodeBlockSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  timestamp: z.number(),
  codeBlocks: z.array(CodeBlockSchema).default([]),
  metadata: z.record(z.unknown()).optional(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ThreadSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  workspaceId: z.string().optional(),
  workspaceName: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  messageCount: z.number().default(0),
  lastMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type Thread = z.infer<typeof ThreadSchema>;

// API request/response schemas
export const IngestRequestSchema = z.object({
  threads: z.array(ThreadSchema),
  messages: z.array(MessageSchema),
});
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

export const ThreadsQuerySchema = z.object({
  workspaceId: z.string().optional(),
  q: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type ThreadsQuery = z.infer<typeof ThreadsQuerySchema>;

export const ThreadsResponseSchema = z.object({
  threads: z.array(ThreadSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});
export type ThreadsResponse = z.infer<typeof ThreadsResponseSchema>;

export const MessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});
export type MessagesQuery = z.infer<typeof MessagesQuerySchema>;

export const MessagesResponseSchema = z.object({
  messages: z.array(MessageSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});
export type MessagesResponse = z.infer<typeof MessagesResponseSchema>;

// WebSocket event schemas
export const WSEventTypeSchema = z.enum([
  'thread.updated',
  'message.created',
  'connection.acknowledged'
]);
export type WSEventType = z.infer<typeof WSEventTypeSchema>;

export const WSEventSchema = z.object({
  type: WSEventTypeSchema,
  data: z.unknown(),
  timestamp: z.number(),
});
export type WSEvent = z.infer<typeof WSEventSchema>;

// Action schemas
export const ActionTypeSchema = z.enum(['slack', 'github', 'agents']);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const SlackActionRequestSchema = z.object({
  prompt: z.string(),
  channel: z.string().optional(),
  template: z.string().optional(),
});
export type SlackActionRequest = z.infer<typeof SlackActionRequestSchema>;

export const GitHubActionRequestSchema = z.object({
  prompt: z.string(),
  repo: z.string(), // owner/repo format
  issueNumber: z.number().optional(),
  prNumber: z.number().optional(),
});
export type GitHubActionRequest = z.infer<typeof GitHubActionRequestSchema>;

export const AgentsActionRequestSchema = z.object({
  prompt: z.string(),
  context: z.string().optional(),
});
export type AgentsActionRequest = z.infer<typeof AgentsActionRequestSchema>;

export const ActionLogSchema = z.object({
  id: z.string(),
  type: ActionTypeSchema,
  who: z.string(), // user identifier
  what: z.string(), // action description
  where: z.string(), // target (channel, repo, etc.)
  when: z.number(), // timestamp
  resultUrl: z.string().optional(),
  success: z.boolean(),
  error: z.string().optional(),
});
export type ActionLog = z.infer<typeof ActionLogSchema>;

// Configuration schemas
export const ServerConfigSchema = z.object({
  port: z.number().default(3001),
  cors: z.object({
    origins: z.array(z.string()).default(['*']),
  }),
  auth: z.object({
    token: z.string(),
  }),
  slack: z.object({
    botToken: z.string().optional(),
    defaultChannel: z.string().optional(),
  }).optional(),
  github: z.object({
    token: z.string().optional(),
  }).optional(),
});
export type ServerConfig = z.infer<typeof ServerConfigSchema>;

export const DesktopCompanionConfigSchema = z.object({
  serverUrl: z.string().url(),
  token: z.string(),
  watchInterval: z.number().default(1000),
  fullRescanInterval: z.number().default(300000), // 5 minutes
});
export type DesktopCompanionConfig = z.infer<typeof DesktopCompanionConfigSchema>;
