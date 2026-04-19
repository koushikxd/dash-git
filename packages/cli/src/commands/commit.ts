import { command } from "cleye";
import { execa } from "execa";
import { black, green, red, bgCyan } from "kolorist";
import {
  intro,
  outro,
  spinner,
  text,
  isCancel,
  confirm,
  select,
  multiselect,
} from "@clack/prompts";
import {
  assertGitRepo,
  getStagedDiff,
  getRawStagedFiles,
  getWorkingTreeStatus,
  getCurrentBranch,
  getDefaultRemote,
  getUpstreamBranch,
  getDetectedMessage,
  getDiffSummary,
  buildCompactSummary,
  getChangedFiles,
  stageAllChanges,
  stageSelectedFiles,
  type ChangedFile,
} from "~/utils/git.js";
import { getConfig } from "~/utils/config.js";
import { generateCommitMessageFromSummary } from "~/utils/groq.js";
import { KnownError, handleCliError } from "~/errors.js";
import { getCommitPromptFile } from "~/utils/prompt.js";

export interface CommitMessageParts {
  subject: string;
  body: string;
}

const buildDiffSnippets = async (
  files: string[],
  perFileMaxLines: number = 30,
  totalMaxChars: number = 4000,
): Promise<string> => {
  try {
    const targetFiles = files.slice(0, 6);
    const parts: string[] = [];
    let remaining = totalMaxChars;

    for (const f of targetFiles) {
      const { stdout } = await execa("git", [
        "diff",
        "--cached",
        "--unified=1",
        "--",
        f,
      ]);
      if (!stdout) continue;

      const lines = stdout.split("\n").filter(Boolean);
      const picked: string[] = [];
      let count = 0;

      for (const line of lines) {
        const isHunk = line.startsWith("@@");
        const isChange =
          (line.startsWith("+") || line.startsWith("-")) &&
          !line.startsWith("+++") &&
          !line.startsWith("---");

        if (isHunk || isChange) {
          picked.push(line);
          count++;
          if (count >= perFileMaxLines) break;
        }
      }

      if (picked.length > 0) {
        const block = [`# ${f}`, ...picked].join("\n");
        if (block.length <= remaining) {
          parts.push(block);
          remaining -= block.length;
        } else {
          parts.push(block.slice(0, Math.max(0, remaining)));
          remaining = 0;
        }
      }
      if (remaining <= 0) break;
    }

    if (parts.length === 0) return "";
    return [
      "Code changes (use this to write the commit message):",
      ...parts,
    ].join("\n\n");
  } catch {
    return "";
  }
};

const formatStatusHint = (status: {
  staged: number;
  unstaged: number;
  untracked: number;
}) => {
  const parts: string[] = [];
  const total = status.unstaged + status.untracked;
  if (status.unstaged > 0) {
    parts.push(`${status.unstaged} unstaged`);
  }
  if (status.untracked > 0) {
    parts.push(`${status.untracked} untracked`);
  }
  if (parts.length === 0) return "";
  const summary = parts.join(", ");
  return `\nDetected ${summary} file${total === 1 ? "" : "s"}.`;
};

const buildNoChangesMessage = async (stageAll: boolean) => {
  const status = await getWorkingTreeStatus();
  const hint = formatStatusHint(status);

  if (status.total === 0) {
    return "No changes to commit. Your working tree is clean.";
  }

  if (stageAll) {
    if (status.staged === 0) {
      return `No changes to commit. Nothing could be staged.${hint}`;
    }
  }

  return `No staged changes found. Stage your changes with \`git add\`, run \`dash\` for interactive staging, or use \`--all\` to stage everything.${hint}`;
};

export const buildSingleCommitPrompt = async (
  files: string[],
  compactSummary: string,
  maxLength: number,
  customPrompt?: string | null,
  messageContext?: string | null,
): Promise<string> => {
  const snippets = await buildDiffSnippets(files, 30, 3500);
  const contextSection = messageContext?.trim()
    ? `\nUSER CONTEXT (helpful guidance, but never override the actual diff):\n${messageContext.trim()}\n`
    : "";

  if (customPrompt) {
    return (
      `${customPrompt}

CHANGES SUMMARY:
${compactSummary}

${contextSection}
${snippets ? `\n${snippets}\n` : ""}

COMMIT FORMAT RULES:
- If the diff is focused, return a single-line commit message only
- If there are several distinct meaningful changes, return:
  type: short summary

  - change 1
  - change 2
- Keep the subject line under ${maxLength} characters
- Use ` -
      ` bullets for the body when needed
- Return only the commit message, no explanations.`
    );
  }

  return `Analyze the following git changes and generate a complete conventional commit message.

CHANGES SUMMARY:
${compactSummary}

${contextSection}
${snippets ? `\n${snippets}\n` : ""}

CRITICAL - READ CAREFULLY:
- Base your message ONLY on what is explicitly shown in the changes above
- DO NOT infer features that aren't directly visible in the code
- If you see className/CSS changes, say "style" or "update UI", NOT "add feature"
- File names can be misleading - focus on the ACTUAL code changes shown
- When uncertain, use conservative terms like "update" or "improve"

TASK: Write ONE conventional commit message describing ONLY what the diff shows.

REQUIREMENTS:
- Always start with: type: subject (NO scope, just type and subject)
- Keep the subject line under ${maxLength} characters
- Describe the actual code change, not assumed functionality
- Use imperative mood, present tense ("add" not "added")
- Include the main component/area affected when clear
- Complete the message - never truncate mid-sentence
- If the changes are small or tightly related, return a single-line commit message only
- If the changes are broad and cover multiple distinct areas, return:
  type: short summary

  - change 1
  - change 2
  - change 3
- Use bullet lines ONLY for major distinct changes
- Each body line must start with "- "

COMMIT TYPE SELECTION:
- feat: ONLY for genuinely NEW user-facing features (new components, new API endpoints, new functionality)
- style: UI changes, CSS modifications, styling updates, className changes
- refactor: code improvements, restructuring, internal changes without new functionality
- fix: bug fixes that resolve issues or errors
- docs: documentation changes only
- test: adding or updating tests
- chore: config updates, maintenance, dependency updates

CORRECT EXAMPLES:
- style: update sidebar styling and add mode toggle
- refactor: simplify form validation logic
- fix: handle null case in user lookup
- feat: add OAuth authentication to login
- chore: update package dependencies

WRONG EXAMPLES (hallucinating features not in diff):
- "feat: add collapsible sidebar" when diff only shows CSS
- "feat: implement new dashboard" when diff shows layout tweaks

Return only the commit message, no explanations.`;
};

export const splitCommitMessage = (message: string): CommitMessageParts => {
  const normalized = message.replace(/\r\n/g, "\n").trim();
  const [subjectLine, ...rest] = normalized.split("\n");
  const subject = subjectLine?.trim() || "";
  const body = rest.join("\n").trim();

  return { subject, body };
};

export const formatCommentedCommitMessage = (message: string) =>
  message
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (line.length > 0 ? `# ${line}` : "#"))
    .join("\n");

export const buildGitCommitArgs = (message: string): string[] => {
  const { subject, body } = splitCommitMessage(message);

  if (!subject) {
    throw new KnownError("Commit message cannot be empty");
  }

  return body
    ? ["commit", "-m", subject, "-m", body]
    : ["commit", "-m", subject];
};

export const stageModes = {
  promptOnEmpty: "prompt-on-empty",
  alwaysPrompt: "always-prompt",
  neverPrompt: "never-prompt",
} as const;

type StageMode = (typeof stageModes)[keyof typeof stageModes];

const hasHeadCommit = async (): Promise<boolean> => {
  const { failed } = await execa("git", ["rev-parse", "--verify", "HEAD"], {
    reject: false,
  });

  return !failed;
};

const resetIndexToHead = async () => {
  if (await hasHeadCommit()) {
    await execa("git", ["reset", "--quiet", "HEAD"]);
    return;
  }

  const stagedFiles = await getRawStagedFiles();
  if (stagedFiles.length === 0) return;

  await execa(
    "git",
    ["rm", "--cached", "-r", "--quiet", "--", ...stagedFiles],
    {
      reject: false,
    },
  );
};

const getFileHint = (file: ChangedFile) => {
  if (file.untracked) return "untracked";
  if (file.originalPath) return `renamed from ${file.originalPath}`;
  if (file.indexStatus === "D" || file.worktreeStatus === "D") return "deleted";
  if (file.indexStatus === "A") return "staged new file";
  if (file.staged && file.unstaged) return "staged + unstaged";
  if (file.staged) return "staged";
  if (file.unstaged) return "modified";
  return "changed";
};

const promptForChangedFiles = async (files: ChangedFile[]) => {
  const selected = await multiselect({
    message: "Select files to stage (Space to toggle, Enter to submit)",
    options: files.map((file) => ({
      value: file.path,
      label: file.path,
      hint: getFileHint(file),
    })),
    initialValues: files.filter((file) => file.staged).map((file) => file.path),
    required: true,
  });

  if (isCancel(selected)) {
    outro("Commit cancelled");
    return null;
  }

  const selectedPaths = new Set(selected as string[]);
  return files.filter((file) => selectedPaths.has(file.path));
};

const promptForStageStrategy = async (
  files: ChangedFile[],
  mode: StageMode,
) => {
  if (mode === stageModes.neverPrompt) {
    return undefined;
  }

  const hasStagedFiles = files.some((file) => file.staged);

  if (mode === stageModes.promptOnEmpty && hasStagedFiles) {
    return undefined;
  }

  if (files.length === 0) {
    return undefined;
  }

  const action = await select({
    message: hasStagedFiles
      ? "Choose how to prepare this commit"
      : "No staged files found. How would you like to stage changes?",
    initialValue: "all",
    options: [
      {
        value: "all",
        label: "Stage all changed files",
        hint: "Default",
      },
      {
        value: "manual",
        label: "Select files manually",
        hint: "Choose files with Space",
      },
      {
        value: "cancel",
        label: "Cancel",
      },
    ],
  });

  if (isCancel(action) || action === "cancel") {
    outro("Commit cancelled");
    return null;
  }

  if (action === "all") {
    await stageAllChanges();
    return "all";
  }

  const selectedFiles = await promptForChangedFiles(files);
  if (selectedFiles === null) {
    return null;
  }

  await resetIndexToHead();
  await stageSelectedFiles(selectedFiles);
  return "manual";
};

export const runCommitWithPush = async (
  generate: number | undefined,
  excludeFiles: string[],
  stageAll: boolean,
  commitType: string | undefined,
  messageContext: string | undefined,
  promptForPush: boolean = false,
  stageMode: StageMode = stageModes.neverPrompt,
) => {
  intro(bgCyan(black(" dash commit ")));
  await assertGitRepo();

  const detectingFiles = spinner();
  let stagedAllChanges = stageAll;

  if (stageAll) {
    await stageAllChanges();
  } else {
    const changedFiles = await getChangedFiles();
    const stagingResult = await promptForStageStrategy(changedFiles, stageMode);
    if (stagingResult === null) {
      return;
    }
    stagedAllChanges = stagingResult === "all";
  }

  detectingFiles.start("Detecting staged files");
  const staged = await getStagedDiff(excludeFiles);

  if (!staged) {
    const rawStaged = await getRawStagedFiles();
    const statusMessage = await buildNoChangesMessage(stagedAllChanges);
    detectingFiles.stop("Detecting staged files");
    if (rawStaged.length > 0) {
      throw new KnownError(
        "Only ignored files are staged. Unstage them or adjust your exclusions, then try again.",
      );
    }
    throw new KnownError(statusMessage);
  }

  const diffSummary = await getDiffSummary(excludeFiles);
  const isLargeDiff = staged.diff.length > 50000;
  const isManyFiles = staged.files.length >= 5;
  const hasLargeIndividualFile = diffSummary?.fileStats.some(
    (f) => f.changes > 500,
  );
  const needsEnhancedAnalysis =
    isLargeDiff || isManyFiles || hasLargeIndividualFile;

  if (needsEnhancedAnalysis && diffSummary) {
    let reason = "Large diff detected";
    if (isManyFiles) reason = "Many files detected";
    else if (hasLargeIndividualFile) reason = "Large file changes detected";

    detectingFiles.stop(
      `${getDetectedMessage(
        staged.files,
      )} (${diffSummary.totalChanges.toLocaleString()} changes):\n${staged.files
        .map((file) => `     ${file}`)
        .join(
          "\n",
        )}\n\n  ${reason} - using enhanced analysis for better commit message`,
    );
  } else {
    detectingFiles.stop(
      `${getDetectedMessage(staged.files)}:\n${staged.files
        .map((file) => `     ${file}`)
        .join("\n")}`,
    );
  }

  const { env } = process;
  const config = await getConfig({
    GROQ_API_KEY: env.GROQ_API_KEY,
    proxy:
      env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
    generate: generate?.toString(),
    type: commitType?.toString(),
  });

  const s = spinner();
  s.start("The AI is analyzing your changes");
  let messages: string[];
  try {
    const customPrompt = await getCommitPromptFile();
    const compact = await buildCompactSummary(excludeFiles, 25);
    if (compact) {
      const enhanced = await buildSingleCommitPrompt(
        staged.files,
        compact,
        config["max-length"],
        customPrompt,
        messageContext,
      );
      messages = await generateCommitMessageFromSummary(
        config.GROQ_API_KEY,
        config.model,
        config.locale,
        enhanced,
        config.generate,
        config["max-length"],
        config.type,
        config.timeout,
        config.proxy,
      );
    } else {
      const fileList = staged.files.join(", ");
      const fallbackPrompt = await buildSingleCommitPrompt(
        staged.files,
        `Files: ${fileList}`,
        config["max-length"],
        customPrompt,
        messageContext,
      );
      messages = await generateCommitMessageFromSummary(
        config.GROQ_API_KEY,
        config.model,
        config.locale,
        fallbackPrompt,
        config.generate,
        config["max-length"],
        config.type,
        config.timeout,
        config.proxy,
      );
    }
  } finally {
    s.stop("Changes analyzed");
  }

  if (messages.length === 0) {
    throw new KnownError("No commit messages were generated. Try again.");
  }

  const generatedMessage = messages[0];
  if (!generatedMessage) {
    throw new KnownError("No commit messages were generated. Try again.");
  }
  const generatedParts = splitCommitMessage(generatedMessage);
  let finalMessage = generatedMessage.trim();

  if (!generatedParts.body) {
    const edited = await text({
      message: "Commit message (edit or press Enter to commit):",
      initialValue: generatedParts.subject,
      validate: (value) =>
        value && value.trim().length > 0
          ? undefined
          : "Message cannot be empty",
    });

    if (isCancel(edited)) {
      outro("Commit cancelled");
      return;
    }

    finalMessage = String(edited).trim();
  } else {
    console.log("\nGenerated multi-line commit message:\n");
    console.log(finalMessage);
    console.log();

    const multilineAction = await select({
      message: "Use this multi-line commit message?",
      initialValue: "commit",
      options: [
        {
          value: "commit",
          label: "Commit with this message",
        },
        {
          value: "subject",
          label: "Edit subject line only",
          hint: "Keep bullet list as generated",
        },
        {
          value: "cancel",
          label: "Cancel",
        },
      ],
    });

    if (isCancel(multilineAction) || multilineAction === "cancel") {
      outro("Commit cancelled");
      return;
    }

    if (multilineAction === "subject") {
      const editedSubject = await text({
        message: "Edit commit subject line:",
        initialValue: generatedParts.subject,
        validate: (value) =>
          value && value.trim().length > 0
            ? undefined
            : "Message cannot be empty",
      });

      if (isCancel(editedSubject)) {
        outro("Commit cancelled");
        return;
      }

      finalMessage = `${String(editedSubject).trim()}\n\n${generatedParts.body}`;
    }
  }

  await execa("git", buildGitCommitArgs(finalMessage));

  outro(`${green("√")} Successfully committed!`);

  if (promptForPush) {
    const shouldPush = await confirm({
      message: "Push to remote? (Press Enter to push, Esc to skip)",
      initialValue: true,
    });

    if (isCancel(shouldPush)) {
      outro("Push cancelled");
      return;
    }

    if (shouldPush) {
      const pushSpinner = spinner();
      pushSpinner.start("Pushing to remote");
      try {
        const upstream = await getUpstreamBranch();
        const pushArgs = ["push"];

        if (!upstream) {
          const remote = await getDefaultRemote();
          const branch = await getCurrentBranch();
          pushArgs.push("-u", remote, branch);
        }

        const { stdout, stderr } = await execa("git", pushArgs);
        pushSpinner.stop("Pushed to remote");
        const output = [stdout, stderr].filter(Boolean).join("\n");
        if (output) {
          console.log(`\n${output.trim()}\n`);
        }
        outro(`${green("√")} Successfully pushed to remote!`);
      } catch (error: unknown) {
        pushSpinner.stop("Push failed");
        const message =
          error instanceof Error ? error.message : "Unknown push error";
        outro(`${red("×")} Failed to push: ${message}`);
      }
    } else {
      outro("Changes not pushed");
    }
  }
};

export default command(
  {
    name: "commit",
    alias: "c",
    help: {
      description: "Generate AI-powered commit messages from staged changes",
    },
    flags: {
      generate: {
        type: Number,
        description: "Number of messages to generate (default: 1)",
        alias: "g",
      },
      exclude: {
        type: [String],
        description: "Files to exclude from AI analysis",
        alias: "x",
      },
      all: {
        type: Boolean,
        description: "Automatically stage changes in tracked files",
        alias: "a",
        default: false,
      },
      type: {
        type: String,
        description: "Type of commit message to generate",
        alias: "t",
      },
      message: {
        type: String,
        description: "Additional context for AI commit message generation",
        alias: "m",
      },
    },
    ignoreArgv: (type) => type === "unknown-flag" || type === "argument",
  },
  (argv) => {
    runCommitWithPush(
      argv.flags.generate,
      argv.flags.exclude,
      argv.flags.all,
      argv.flags.type,
      argv.flags.message,
      true,
      stageModes.promptOnEmpty,
    ).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      outro(`${red("×")} ${message}`);
      handleCliError(error);
      process.exit(1);
    });
  },
);
