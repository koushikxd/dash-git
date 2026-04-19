import type { CommitType } from "~/utils/config.js";
import { findUp, readFile } from "~/utils/fs.js";
import { assertGitRepo } from "~/utils/git.js";

export interface PRContext {
  branchName: string;
  baseBranch: string;
  commits: Array<{ message: string; body: string }>;
  stats: { files: number; insertions: number; deletions: number };
  issue?: number;
  diffSummary?: string;
}

export interface SummaryContext {
  currentBranch: string;
  targetBranch: string;
  commits: Array<{ message: string; body: string }>;
  stats: { files: number; insertions: number; deletions: number };
  diffSummary?: string;
}

const commitTypeFormats: Record<CommitType, string> = {
  "": "<commit message>",
  conventional: "<type>(<optional scope>): <commit message>",
};

const commitTypes: Record<CommitType, string> = {
  "": "",
  conventional: `Choose the most appropriate type from the following categories that best describes the git diff:

${JSON.stringify(
  {
    feat: "A NEW user-facing feature or functionality that adds capabilities",
    fix: "A bug fix that resolves an existing issue",
    docs: "Documentation only changes (README, comments, etc)",
    style:
      "Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)",
    refactor:
      "Code restructuring, improvements, or internal changes that enhance existing functionality",
    perf: "A code change that improves performance",
    test: "Adding missing tests or correcting existing tests",
    build: "Changes that affect the build system or external dependencies",
    ci: "Changes to our CI configuration files and scripts",
    chore:
      "Maintenance tasks, config updates, dependency updates, or internal tooling changes",
    revert: "Reverts a previous commit",
  },
  null,
  2,
)}

IMPORTANT: 
- Use 'feat' ONLY for NEW user-facing features
- Use 'refactor' for code improvements, restructuring, or internal changes
- Use 'chore' for config updates, maintenance, or internal tooling
- Use the exact type name from the list above.`,
};

export const generatePrompt = (
  locale: string,
  maxLength: number,
  type: CommitType,
) => {
  const basePrompt =
    `You are a professional git commit message generator. Generate ONLY conventional commit messages.

CRITICAL RULES:
- Return ONLY the commit message, nothing else
- Always use a subject line formatted as: type: subject (NO scope, just type and subject)
- The subject line must be at most ${maxLength} characters
- Imperative mood, present tense
- Be specific and descriptive
- For small or focused diffs, return a single-line commit message only
- For large diffs with several distinct meaningful changes, return:
  type: short summary

  - change 1
  - change 2
  - change 3
- Only add bullet lines when they genuinely help explain multiple separate changes
- Keep the body concise and use ` -
    ` bullets for each major change
- NO explanations, questions, or meta-commentary
- ALWAYS complete the message - never truncate mid-sentence

ACCURACY RULES (VERY IMPORTANT):
- Describe ONLY what is explicitly shown in the provided diff/changes
- DO NOT infer, assume, or imagine features not directly visible in the code
- DO NOT base commit messages solely on file names - read the actual changes
- If you see CSS/styling changes, say "style" or "update styling", NOT "add feature"
- If you see className/UI changes without new functionality, it's "style" NOT "feat"
- When uncertain about the scope, use more general terms ("update", "improve") rather than specific features
- Focus on what the code actually does, not what you think it might enable

COMMIT TYPES (use the right one):
- feat: NEW user-facing feature or functionality (new components, new APIs, new capabilities)
- fix: bug fix that resolves an issue or error
- docs: documentation changes only
- style: formatting, CSS/UI changes, white-space (no logic change)
- refactor: code restructuring, improvements without changing behavior
- perf: performance improvements
- test: adding/updating tests
- build: build system changes
- ci: CI/CD changes
- chore: maintenance tasks, dependencies, config updates

QUALITY GUIDELINES:
- Start with the most important change
- If the changes fit cleanly in one subject line, prefer the single-line format
- If the changes span several clear areas, keep the subject line broad and use bullets for the major changes
- Use specific, descriptive language based on actual code changes
- Include the main component/area affected when clear
- Be clear about what was done, not just what files changed
- Use proper grammar and punctuation
- Prioritize completeness without hallucinating: mention only real changes from the diff

CORRECT EXAMPLES:
- feat: add user login with OAuth integration
- feat: add sidebar, user profile page and API endpoints
- feat: add branch summary command and update docs
- fix: resolve memory leak in image processing service
- fix: correct validation logic and add tests
- refactor: improve message generation, update error handling and more
- style: update sidebar styling, refine button components and add mode toggle
- style: update navigation layout and other UI improvements
- docs: update installation and configuration guide
- chore: update axios to v1.6.0 for security patches
- refactor: update commit flow and model selection

  - add interactive file staging when no files are staged
  - preserve multi-line commit bodies for larger diffs
  - refresh the recommended Groq model list

WRONG EXAMPLES (these are hallucinations - don't do this):
- "feat: add collapsible sidebar" when diff only shows CSS changes
- "feat: implement dark mode" when diff only adds a toggle button
- "feat: add new dashboard" when diff only adjusts layouts
- feat(auth): add user login  [wrong: has scope]
- refactor(commit): improve prompts  [wrong: has scope]

${commitTypes[type] ? `\nDETAILED TYPE GUIDELINES:\n${commitTypes[type]}` : ""}

Language: ${locale}
Output format: ${commitTypeFormats[type] || "type: subject"}

Generate a single, complete, professional commit message that accurately describes ONLY what is shown in the provided changes.`;

  return basePrompt;
};

const getGitRoot = async (): Promise<string | null> => {
  try {
    return await assertGitRepo();
  } catch {
    return null;
  }
};

export const getCommitPromptFile = async (): Promise<string | null> => {
  const root = await getGitRoot();
  const promptPath = await findUp(".dash/commit.md", {
    stopAt: root || process.cwd(),
    type: "file",
  });
  if (!promptPath) return null;
  return readFile(promptPath);
};

export const getPRPromptFile = async (): Promise<string | null> => {
  const root = await getGitRoot();
  const promptPath = await findUp(".dash/pr.md", {
    stopAt: root || process.cwd(),
    type: "file",
  });
  if (!promptPath) return null;
  return readFile(promptPath);
};

export const getSummaryPromptFile = async (): Promise<string | null> => {
  const root = await getGitRoot();
  const promptPath = await findUp(".dash/summary.md", {
    stopAt: root || process.cwd(),
    type: "file",
  });
  if (!promptPath) return null;
  return readFile(promptPath);
};

export const generatePRSystemPrompt = (
  customPrompt?: string | null,
): string => {
  if (customPrompt) {
    return `You are a professional developer writing pull request descriptions. Follow the user's guidelines.`;
  }

  return `You are a professional developer writing pull request descriptions for open source projects.
Write clear, concise, and informative PR titles and descriptions.
Focus on WHAT changed, WHY it was changed, and provide helpful context for reviewers.
Use proper markdown formatting for the body.`;
};

export const buildPRPrompt = (
  context: PRContext,
  customPrompt?: string | null,
): string => {
  const commitList = context.commits
    .map((c, i) => `${i + 1}. ${c.message}${c.body ? `\n   ${c.body}` : ""}`)
    .join("\n");

  const knownTypes = new Set([
    "feat",
    "fix",
    "docs",
    "style",
    "refactor",
    "perf",
    "test",
    "build",
    "ci",
    "chore",
    "revert",
  ]);
  const commitTypesFound = context.commits
    .map((c) => {
      const match = c.message.match(/^([a-z]+)(?:\([^)]+\))?:\s+/i);
      const type = match?.[1]?.toLowerCase() || "";
      return knownTypes.has(type) ? type : "other";
    })
    .reduce<Record<string, number>>((acc, t) => {
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {});
  const commitTypeSummary = Object.entries(commitTypesFound)
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => `${t}: ${n}`)
    .join(", ");

  const contextInfo = `BRANCH: ${context.branchName}
BASE BRANCH: ${context.baseBranch}
STATS (for your reference only, do not include in output): ${
    context.stats.files
  } files, +${context.stats.insertions} -${context.stats.deletions}
${context.issue ? `RELATED ISSUE: #${context.issue}\n` : ""}
COMMIT TYPES: ${commitTypeSummary || "unknown"}
COMMITS (${context.commits.length} total):
${commitList}${
  context.diffSummary
    ? `\n\nDIFF SUMMARY (top files):\n${context.diffSummary}`
    : ""
}`;

  if (customPrompt) {
    return `${customPrompt}

${contextInfo}

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: <your title here>
BODY:
<your markdown body here>

Do not include any other text or explanations.`;
  }

  const isSimple = context.commits.length <= 2 && context.stats.files <= 3;

  return `Generate a pull request title and description based on the following context.

${contextInfo}

REQUIREMENTS:
1. Title: 
   - Use conventional commit format: type: description
   - Maximum 72 characters
   - Reflect the overall PR, not a single commit message
   - Do not copy any commit message verbatim
   - If changes span multiple types/areas, prefer a broad type like "chore" or "refactor"
   - Otherwise pick the dominant type based on the overall changes
   - Be specific about the major themes (e.g., tooling + UI), not generic

2. Body: 
   - Use markdown formatting
   - ${isSimple ? "Keep it brief and focused" : "Be thorough and detailed"}
   - Structure with clear sections
   - Describe WHAT changed functionally, not raw statistics
   - Do NOT include file counts, additions/deletions, or any numeric stats in the body
   - Cover all major areas represented in the commit list (do not ignore later commits)
   ${context.issue ? `- Include "Closes #${context.issue}" at the end` : ""}

BODY STRUCTURE:
## Summary
<1-3 sentences explaining the overall change set and why it matters>

## Changes
- Group by theme when multiple areas exist (e.g., Tooling, UI, Docs)
- Use bullets with concrete details (what changed, where, and why)
- Mention key files/components when clear from the diff summary
${context.issue ? `\n## Related Issues\nCloses #${context.issue}` : ""}

EXAMPLES OF GOOD PR DESCRIPTIONS:

Example 1 (Tooling / Maintenance):
TITLE: chore: replace ESLint with Biome and refresh dependencies
BODY:
## Summary
Modernizes the development workflow by standardizing on Biome for linting/formatting and updating project dependencies for consistency and faster CI.

## Changes
- Removed ESLint config and related packages
- Added Biome configuration and updated scripts/tooling to use Biome
- Updated dependency versions and lockfile to match the new setup

Example 2 (UI / Styling):
TITLE: style: refresh docs viewer and sidebar layout
BODY:
## Summary
Improves readability and navigation by refining the docs viewer layout, sidebar styling, and related UI components.

## Changes
- Updated sidebar spacing, typography, and active states for clearer navigation
- Refined docs viewer styles to improve content hierarchy and code block presentation
- Polished related UI components to keep visuals consistent across the app

BAD EXAMPLE (never do this):
TITLE: chore: update files
BODY:
11 files changed, +2242 additions, -4373 deletions.

^ This is WRONG. Never echo raw stats. Always describe the actual functional changes.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
TITLE: <your title here>
BODY:
<your markdown body here>

Do not include any other text or explanations. Write a real, specific description for this PR based on the actual changes shown above.`;
};

export const buildSummaryPrompt = (
  context: SummaryContext,
  customPrompt?: string | null,
): string => {
  const commitList = context.commits
    .map((c, i) => `${i + 1}. ${c.message}${c.body ? `\n   ${c.body}` : ""}`)
    .join("\n");

  const contextInfo = `CURRENT BRANCH: ${context.currentBranch}
TARGET BRANCH: ${context.targetBranch}
STATS: ${context.stats.files} files changed, +${context.stats.insertions} -${
    context.stats.deletions
  }
COMMITS (${context.commits.length} total):
${commitList}${
  context.diffSummary
    ? `\n\nDIFF SUMMARY (top files):\n${context.diffSummary}`
    : ""
}`;

  if (customPrompt) {
    return `${customPrompt}

${contextInfo}

Generate a comprehensive summary of what happened in this branch.

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
## Summary
<1-3 sentences explaining the overall change set>

## Changes
- <bullet point describing a specific change>
- <bullet point describing another change>
- <continue with more bullets as needed>

Do not include any other text or explanations.`;
  }

  return `Generate a comprehensive summary of what happened in the branch "${context.currentBranch}" compared to "${context.targetBranch}".

${contextInfo}

REQUIREMENTS:
1. Provide a clear, high-level summary (1-3 sentences) of what the branch accomplishes
2. List specific changes in bullet points that describe WHAT changed functionally
3. Focus on the actual code changes shown in the commits and diff, not assumptions
4. Group related changes together when appropriate
5. Be specific about components, files, or areas affected when clear from the context
6. Do NOT include raw statistics (file counts, line numbers) in your summary
7. Use clear, professional language suitable for a developer audience

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:
## Summary
<1-3 sentences explaining the overall change set and why it matters>

## Changes
- <bullet point describing a specific change>
- <bullet point describing another change>
- <continue with more bullets as needed>

EXAMPLE OUTPUT:

## Summary
Improves readability and navigation by refining the docs viewer layout, sidebar styling, and related UI components.

## Changes
- Updated sidebar spacing, typography, and active states for clearer navigation
- Refined docs viewer styles to improve content hierarchy and code block presentation
- Polished related UI components to keep visuals consistent across the app

Do not include any other text or explanations. Write a real, specific summary based on the actual changes shown above.`;
};
