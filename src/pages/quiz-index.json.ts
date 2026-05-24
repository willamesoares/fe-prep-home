import type { APIRoute } from 'astro';
import { loadAllQuizQuestions } from '@/lib/loadQuestions';

export const GET: APIRoute = async () => {
  const questions = await loadAllQuizQuestions();
  return new Response(JSON.stringify({ questions }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
