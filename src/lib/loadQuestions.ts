import { getCollection, type CollectionEntry } from 'astro:content';
import { renderMarkdown } from './renderMarkdown';

const ANSWER_HEADING = /^#\s+Answer\s*$/m;
const QUESTION_HEADING = /^#\s+Question\s*$/m;

export interface QuizQuestion {
  slug: string;
  title: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  questionHtml: string;
  answerHtml: string;
}

function splitMarkdown(body: string): { question: string; answer: string } {
  const answerMatch = body.match(ANSWER_HEADING);
  if (!answerMatch || answerMatch.index === undefined) {
    return { question: body, answer: '' };
  }
  const before = body.slice(0, answerMatch.index);
  const after = body.slice(answerMatch.index + answerMatch[0].length);
  const question = before.replace(QUESTION_HEADING, '').trim();
  return { question, answer: after.trim() };
}

export async function loadAllQuizQuestions(): Promise<QuizQuestion[]> {
  const entries = await getCollection('questions');
  const out: QuizQuestion[] = [];
  for (const entry of entries as CollectionEntry<'questions'>[]) {
    const body = (entry as unknown as { body?: string }).body ?? '';
    const { question, answer } = splitMarkdown(body);
    const [questionHtml, answerHtml] = await Promise.all([
      renderMarkdown(question),
      renderMarkdown(answer),
    ]);
    out.push({
      slug: entry.id,
      title: entry.data.title,
      tags: entry.data.tags as string[],
      difficulty: entry.data.difficulty,
      questionHtml,
      answerHtml,
    });
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
