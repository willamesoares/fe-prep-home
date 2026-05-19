import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { TAGS, DIFFICULTIES } from '@/lib/constants';

const questions = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content' }),
  schema: z.object({
    title: z.string().min(1).max(200),
    tags: z.array(z.enum(TAGS)).min(1),
    difficulty: z.enum(DIFFICULTIES),
    author: z.string().optional(),
  }),
});

export const collections = { questions };

export { TAGS, DIFFICULTIES };
