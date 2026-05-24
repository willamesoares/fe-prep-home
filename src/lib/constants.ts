export const TAGS = [
  'react',
  'js',
  'css',
  'html',
  'performance',
  'algorithm',
  'a11y',
  'tooling',
] as const;

export type Tag = (typeof TAGS)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TAG_PATTERN = /^[a-z0-9-]+$/;

export function normalizeTag(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-');
}
