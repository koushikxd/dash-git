import Groq from "groq-sdk";
import { KnownError } from "~/errors.js";
import type { CommitType } from "~/utils/config.js";
import {
  generatePrompt,
  generatePRSystemPrompt,
  buildPRPrompt,
  buildSummaryPrompt,
  type PRContext,
  type SummaryContext,
} from "~/utils/prompt.js";

const createChatCompletion = async (
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  top_p: number,
  frequency_penalty: number,
  presence_penalty: number,
  max_tokens: number,
  n: number,
  timeout: number,
  _proxy?: string,
) => {
  const client = new Groq({
    apiKey,
    timeout,
  });

  try {
    if (n > 1) {
      const completions = await Promise.all(
        Array.from({ length: n }, () =>
          client.chat.completions.create({
            model,
            messages: messages as Groq.Chat.ChatCompletionMessageParam[],
            temperature,
            top_p,
            frequency_penalty,
            presence_penalty,
            max_tokens,
            n: 1,
          }),
        ),
      );

      return {
        choices: completions.flatMap((completion) => completion.choices),
      };
    }

    const completion = await client.chat.completions.create({
      model,
      messages: messages as Groq.Chat.ChatCompletionMessageParam[],
      temperature,
      top_p,
      frequency_penalty,
      presence_penalty,
      max_tokens,
      n: 1,
    });

    return completion;
  } catch (error: unknown) {
    if (error instanceof Groq.APIError) {
      let errorMessage = `Groq API Error: ${error.status} - ${error.name}`;

      if (error.message) {
        errorMessage += `\n\n${error.message}`;
      }

      if (error.status === 500) {
        errorMessage +=
          "\n\nCheck the API status: https://console.groq.com/status";
      }

      if (
        error.status === 413 ||
        error.message?.includes("rate_limit_exceeded")
      ) {
        errorMessage +=
          "\n\n💡 Tip: Your diff is too large. Try:\n" +
          "1. Commit files in smaller batches\n" +
          "2. Exclude large files with --exclude\n" +
          "3. Use a different model with --model\n" +
          "4. Check if you have build artifacts staged (dist/, .next/, etc.)";
      }

      throw new KnownError(errorMessage);
    }

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOTFOUND"
    ) {
      const err = error as { hostname?: string; syscall?: string };
      throw new KnownError(
        `Error connecting to ${err.hostname} (${err.syscall}). Are you connected to the internet?`,
      );
    }

    throw error;
  }
};

const sanitizeMessage = (message: string) =>
  message
    .trim()
    .replace(/^["']|["']\.?$/g, "")
    .replace(/[\n\r]/g, "")
    .replace(/(\w)\.$/, "$1");

const sanitizeCommitMessage = (message: string) => {
  const cleaned = message
    .trim()
    .replace(/^```[\w-]*\n?/g, "")
    .replace(/\n?```$/g, "")
    .replace(/\r\n/g, "\n");

  const lines = cleaned.split("\n");
  const normalized: string[] = [];
  let previousBlank = false;

  for (const [index, rawLine] of lines.entries()) {
    const trimmedRight = rawLine.trimEnd();
    const trimmed = trimmedRight.trim();

    if (!trimmed) {
      if (!previousBlank && normalized.length > 0) {
        normalized.push("");
      }
      previousBlank = true;
      continue;
    }

    let line = trimmed;

    if (index === 0) {
      line = line.replace(/^["']|["']\.?$/g, "").replace(/(\w)\.$/, "$1");
    }

    if (/^[-*]\s+/.test(line)) {
      line = `- ${line.replace(/^[-*]\s+/, "").trim()}`;
    }

    normalized.push(line);
    previousBlank = false;
  }

  return normalized.join("\n").trim();
};

const normalizeCommitMessageLength = (message: string, maxLength: number) => {
  const [subject, ...rest] = message.split("\n");
  const safeSubject = enforceMaxLength(subject?.trim() || "", maxLength);
  const body = rest.join("\n").trim();

  return body ? `${safeSubject}\n\n${body}` : safeSubject;
};

const enforceMaxLength = (message: string, maxLength: number): string => {
  if (message.length <= maxLength) return message;

  const cut = message.slice(0, maxLength);

  const sentenceEnd = Math.max(
    cut.lastIndexOf(". "),
    cut.lastIndexOf("! "),
    cut.lastIndexOf("? "),
  );

  if (sentenceEnd > maxLength * 0.7) {
    return cut.slice(0, sentenceEnd + 1);
  }

  const clauseEnd = Math.max(cut.lastIndexOf(", "), cut.lastIndexOf("; "));

  if (clauseEnd > maxLength * 0.6) {
    return cut.slice(0, clauseEnd + 1);
  }

  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.5) {
    return cut.slice(0, lastSpace);
  }

  if (message.length > maxLength + 10) {
    return `${cut}...`;
  }

  return cut;
};

const deduplicateMessages = (array: string[]) => Array.from(new Set(array));

const conventionalPrefixes = [
  "feat:",
  "fix:",
  "docs:",
  "style:",
  "refactor:",
  "perf:",
  "test:",
  "build:",
  "ci:",
  "chore:",
  "revert:",
];

const deriveMessageFromReasoning = (
  text: string,
  maxLength: number,
): string | null => {
  const cleaned = text.replace(/\s+/g, " ").trim();

  const match = cleaned.match(
    /\b(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)\b\s*:?\s+[^.\n]+/i,
  );
  let candidate = match ? match[0] : cleaned.split(/[.!?]/)[0];

  if (!match && candidate.length < 10) {
    const sentences = cleaned
      .split(/[.!?]/)
      .filter((s) => s.trim().length > 10);
    if (sentences.length > 0) {
      candidate = sentences[0].trim();
    }
  }

  const lower = candidate.toLowerCase();
  for (const prefix of conventionalPrefixes) {
    const p = prefix.slice(0, -1);
    if (lower.startsWith(`${p} `) && !lower.startsWith(prefix)) {
      candidate = `${p}: ${candidate.slice(p.length + 1)}`;
      break;
    }
  }

  candidate = sanitizeMessage(candidate);
  if (!candidate || candidate.length < 5) return null;

  if (candidate.length > maxLength * 1.2) {
    candidate = enforceMaxLength(candidate, maxLength);
  }

  return candidate;
};

export const generateCommitMessageFromSummary = async (
  apiKey: string,
  model: string,
  locale: string,
  summary: string,
  completions: number,
  maxLength: number,
  type: CommitType,
  timeout: number,
  proxy?: string,
) => {
  const prompt = summary;
  const completion = await createChatCompletion(
    apiKey,
    model,
    [
      { role: "system", content: generatePrompt(locale, maxLength, type) },
      { role: "user", content: prompt },
    ],
    0.3,
    1,
    0,
    0,
    Math.max(300, maxLength * 12),
    completions,
    timeout,
    proxy,
  );

  const messages = (completion.choices || [])
    .map((c) => c.message?.content || "")
    .map((t) => sanitizeCommitMessage(t as string))
    .filter(Boolean)
    .map((t) => {
      const [subject] = t.split("\n");
      if ((subject?.length || 0) > maxLength * 1.1) {
        return normalizeCommitMessageLength(t, maxLength);
      }
      return t;
    })
    .filter((msg) => {
      const [subject] = msg.split("\n");
      return (subject?.trim().length || 0) >= 10;
    });

  if (messages.length > 0) return deduplicateMessages(messages);

  const reasons = (completion.choices as { message?: { reasoning?: string } }[])
    .map((c) => c.message?.reasoning || "")
    .filter(Boolean) as string[];
  for (const r of reasons) {
    const derived = deriveMessageFromReasoning(r, maxLength);
    if (derived) return [derived];
  }

  return [];
};

export interface PRContent {
  title: string;
  body: string;
}

const parsePRResponse = (response: string): PRContent => {
  const titleMatch = response.match(/TITLE:\s*(.+?)(?:\n|BODY:)/s);
  const bodyMatch = response.match(/BODY:\s*([\s\S]+)/);

  const title = titleMatch?.[1]?.trim() || "";
  const body = bodyMatch?.[1]?.trim() || "";

  return { title, body };
};

export const generatePRContent = async (
  apiKey: string,
  model: string,
  context: PRContext,
  timeout: number,
  proxy?: string,
  customPrompt?: string | null,
  issue?: number,
): Promise<PRContent> => {
  const contextWithIssue = { ...context, issue };

  const completion = await createChatCompletion(
    apiKey,
    model,
    [
      { role: "system", content: generatePRSystemPrompt(customPrompt) },
      { role: "user", content: buildPRPrompt(contextWithIssue, customPrompt) },
    ],
    0.4,
    1,
    0,
    0,
    2000,
    1,
    timeout,
    proxy,
  );

  const content = completion.choices?.[0]?.message?.content || "";
  const parsed = parsePRResponse(content);

  if (!parsed.title) {
    const fallbackTitle =
      context.commits.length > 1
        ? `chore: update ${context.branchName.replace(/[-/]+/g, " ")}`
        : context.commits[0]?.message || `Merge ${context.branchName}`;
    parsed.title = fallbackTitle.trim().slice(0, 72);
  }

  if (!parsed.body) {
    const commitSummary = context.commits
      .slice(0, 10)
      .map((c) => `- ${c.message}`)
      .join("\n");
    parsed.body = `## Changes\n\n${commitSummary}`;
  }

  if (issue && !parsed.body.includes(`#${issue}`)) {
    parsed.body += `\n\nCloses #${issue}`;
  }

  return parsed;
};

export interface ExistingPRInfo {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
}

export const generatePRUpdateContent = async (
  apiKey: string,
  model: string,
  existingPR: ExistingPRInfo,
  editRequest: string,
  context: PRContext,
  timeout: number,
  proxy?: string,
  _customPrompt?: string | null,
): Promise<PRContent> => {
  const systemPrompt = `You are a professional developer updating a pull request description.
You will be given the current PR title and body, along with a user's request for changes.
Update the PR to incorporate the requested changes while preserving relevant existing content.
Use markdown formatting for the body.`;

  const userPrompt = `CURRENT PR #${existingPR.number}:
Title: ${existingPR.title}
Body:
${existingPR.body || "(empty)"}

USER'S EDIT REQUEST:
${editRequest}

LATEST COMMITS:
${context.commits.map((c, i) => `${i + 1}. ${c.message}`).join("\n")}

Generate an updated PR title and description that incorporates the user's requested changes.

IMPORTANT RULES:
- Describe WHAT changed functionally, not raw statistics
- Do NOT include file counts, additions/deletions, or any numeric stats in your response
- Focus on the actual changes from the commits above

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: <your updated title here>
BODY:
<your updated markdown body here>

Do not include any other text or explanations.`;

  const completion = await createChatCompletion(
    apiKey,
    model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    0.4,
    1,
    0,
    0,
    1500,
    1,
    timeout,
    proxy,
  );

  const content = completion.choices?.[0]?.message?.content || "";
  const parsed = parsePRResponse(content);

  if (!parsed.title) {
    parsed.title = existingPR.title;
  }

  if (!parsed.body) {
    parsed.body = existingPR.body || "";
  }

  return parsed;
};

export const generateMergeCommitMessage = async (
  apiKey: string,
  model: string,
  prTitle: string,
  prBody: string,
  timeout: number,
  proxy?: string,
): Promise<string> => {
  const systemPrompt = `You are generating a concise merge commit message for a pull request.
The message should summarize what the PR accomplishes in one line.
Keep it under 72 characters. Use imperative mood.
Do not include PR numbers or branch names.`;

  const userPrompt = `PR Title: ${prTitle}

PR Description:
${prBody.slice(0, 1000)}

Generate a concise merge commit message. Return only the message, nothing else.`;

  const completion = await createChatCompletion(
    apiKey,
    model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    0.3,
    1,
    0,
    0,
    100,
    1,
    timeout,
    proxy,
  );

  const content = completion.choices?.[0]?.message?.content || "";
  const message = sanitizeMessage(content);

  return message || prTitle;
};

export const generateBranchSummary = async (
  apiKey: string,
  model: string,
  context: SummaryContext,
  timeout: number,
  proxy?: string,
  customPrompt?: string | null,
): Promise<string> => {
  const systemPrompt = `You are a professional developer writing branch summaries.
Write clear, concise, and informative summaries that describe what happened in the branch.
Focus on WHAT changed and WHY. Use markdown formatting.`;

  const userPrompt = buildSummaryPrompt(context, customPrompt);

  const completion = await createChatCompletion(
    apiKey,
    model,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    0.4,
    1,
    0,
    0,
    2000,
    1,
    timeout,
    proxy,
  );

  const content = completion.choices?.[0]?.message?.content || "";

  if (!content || content.trim().length === 0) {
    const commitSummary = context.commits
      .slice(0, 10)
      .map((c) => `- ${c.message}`)
      .join("\n");
    return `## Summary\nBranch contains ${context.commits.length} commit${
      context.commits.length > 1 ? "s" : ""
    } with various changes.\n\n## Changes\n${commitSummary}`;
  }

  return content.trim();
};
