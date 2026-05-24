const ANSWER_HEADING_RE = /<h1[^>]*>\s*Answer\s*<\/h1>/i;

export interface SplitResult {
  questionHtml: string;
  answerHtml: string;
}

export function splitRenderedHTML(html: string): SplitResult {
  const match = html.match(ANSWER_HEADING_RE);
  if (!match || match.index === undefined) {
    return { questionHtml: html, answerHtml: '' };
  }
  const questionHtml = html.slice(0, match.index);
  const answerHtml = html.slice(match.index + match[0].length);
  return {
    questionHtml: stripQuestionHeading(questionHtml),
    answerHtml: answerHtml.trim(),
  };
}

function stripQuestionHeading(html: string): string {
  return html.replace(/<h1[^>]*>\s*Question\s*<\/h1>/i, '').trim();
}

export function hasBothSections(markdown: string): boolean {
  const lines = markdown.split('\n');
  let sawQuestion = false;
  let sawAnswer = false;
  for (const line of lines) {
    if (/^#\s+Question\s*$/.test(line)) sawQuestion = true;
    if (/^#\s+Answer\s*$/.test(line)) sawAnswer = true;
  }
  return sawQuestion && sawAnswer;
}
