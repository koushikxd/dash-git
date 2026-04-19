import { execa } from "execa";
import { KnownError } from "~/errors.js";
import { getConfig } from "~/utils/config.js";

export const assertGitRepo = async () => {
  const { stdout, failed } = await execa(
    "git",
    ["rev-parse", "--show-toplevel"],
    { reject: false },
  );

  if (failed) {
    throw new KnownError("The current directory must be a Git repository!");
  }

  return stdout;
};

const excludeFromDiff = (path: string) => `:(exclude)${path}`;

const filesToExclude = [
  "package-lock.json",
  "node_modules/**",
  "dist/**",
  "build/**",
  ".next/**",
  "coverage/**",
  ".nyc_output/**",
  "*.log",
  "*.tmp",
  "*.temp",
  "*.cache",
  ".DS_Store",
  "Thumbs.db",
  "*.min.js",
  "*.min.css",
  "*.bundle.js",
  "*.bundle.css",
  "*.lock",
].map(excludeFromDiff);

export const getStagedDiff = async (excludeFiles?: string[]) => {
  const diffCached = ["diff", "--cached", "--diff-algorithm=minimal"];
  const { stdout: files } = await execa("git", [
    ...diffCached,
    "--name-only",
    ...filesToExclude,
    ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
  ]);

  if (!files) {
    return;
  }

  const { stdout: diff } = await execa("git", [
    ...diffCached,
    ...filesToExclude,
    ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
  ]);

  return {
    files: files.split("\n"),
    diff,
  };
};

export const getRawStagedFiles = async (): Promise<string[]> => {
  const { stdout } = await execa("git", ["diff", "--cached", "--name-only"]);
  if (!stdout) return [];
  return stdout.split("\n").filter(Boolean);
};

export interface ChangedFile {
  path: string;
  originalPath?: string;
  indexStatus: string;
  worktreeStatus: string;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
  pathspecs: string[];
}

const renameStatuses = new Set(["R", "C"]);

const parseStatusEntry = (
  entry: string,
  originalPath?: string,
): ChangedFile => {
  const indexStatus = entry[0] ?? " ";
  const worktreeStatus = entry[1] ?? " ";
  const path = entry.slice(3);
  const pathspecs = [path];

  if (originalPath) {
    pathspecs.push(originalPath);
  }

  return {
    path,
    originalPath,
    indexStatus,
    worktreeStatus,
    staged:
      indexStatus !== " " && indexStatus !== "?" && indexStatus !== undefined,
    unstaged: worktreeStatus !== " " && worktreeStatus !== undefined,
    untracked: indexStatus === "?" && worktreeStatus === "?",
    pathspecs,
  };
};

export const parseChangedFiles = (statusOutput: string): ChangedFile[] => {
  if (!statusOutput) return [];

  const entries = statusOutput.split("\0").filter(Boolean);
  const files: ChangedFile[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (!entry) continue;
    const indexStatus = entry[0] ?? " ";
    const worktreeStatus = entry[1] ?? " ";
    const hasOriginalPath =
      renameStatuses.has(indexStatus) || renameStatuses.has(worktreeStatus);

    if (hasOriginalPath) {
      const originalPath = entries[index + 1];
      files.push(parseStatusEntry(entry, originalPath));
      index++;
      continue;
    }

    files.push(parseStatusEntry(entry));
  }

  return files;
};

export const getChangedFiles = async (): Promise<ChangedFile[]> => {
  const { stdout } = await execa("git", [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);

  return parseChangedFiles(stdout);
};

export const getWorkingTreeStatus = async () => {
  const files = await getChangedFiles();
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;

  for (const file of files) {
    if (file.untracked) {
      untracked++;
      continue;
    }
    if (file.staged) staged++;
    if (file.unstaged) unstaged++;
  }

  return {
    staged,
    unstaged,
    untracked,
    total: files.length,
  };
};

const deduplicatePathspecs = (files: ChangedFile[]) =>
  Array.from(new Set(files.flatMap((file) => file.pathspecs))).filter(Boolean);

export const stageAllChanges = async () => {
  await execa("git", ["add", "--all"]);
};

export const stageSelectedFiles = async (files: ChangedFile[]) => {
  const pathspecs = deduplicatePathspecs(files);
  if (pathspecs.length === 0) return;

  await execa("git", ["add", "--all", "--", ...pathspecs]);
};

export const getDetectedMessage = (files: string[]) =>
  `Detected ${files.length.toLocaleString()} staged file${
    files.length > 1 ? "s" : ""
  }`;

export const estimateTokenCount = (text: string): number => {
  return Math.ceil(text.length / 4);
};

export const chunkDiff = (diff: string, maxTokens: number = 4000): string[] => {
  const estimatedTokens = estimateTokenCount(diff);

  if (estimatedTokens <= maxTokens) {
    return [diff];
  }

  const chunks: string[] = [];
  const lines = diff.split("\n");
  let currentChunk = "";
  let currentTokens = 0;

  for (const line of lines) {
    const lineTokens = estimateTokenCount(line);

    if (currentTokens + lineTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = `${line}\n`;
      currentTokens = lineTokens;
    } else {
      currentChunk += `${line}\n`;
      currentTokens += lineTokens;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

export const getDiffSummary = async (excludeFiles?: string[]) => {
  const diffCached = ["diff", "--cached", "--diff-algorithm=minimal"];
  const { stdout: files } = await execa("git", [
    ...diffCached,
    "--name-only",
    ...filesToExclude,
    ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
  ]);

  if (!files) {
    return null;
  }

  const fileList = files.split("\n").filter(Boolean);

  const fileStats = await Promise.all(
    fileList.map(async (file) => {
      try {
        const { stdout: stat } = await execa("git", [
          ...diffCached,
          "--numstat",
          "--",
          file,
        ]);
        const [additions, deletions] = stat.split("\t").slice(0, 2).map(Number);
        return {
          file,
          additions: additions || 0,
          deletions: deletions || 0,
          changes: (additions || 0) + (deletions || 0),
        };
      } catch {
        return { file, additions: 0, deletions: 0, changes: 0 };
      }
    }),
  );

  return {
    files: fileList,
    fileStats,
    totalChanges: fileStats.reduce((sum, stat) => sum + stat.changes, 0),
  };
};

export const splitDiffByFile = (diff: string): string[] => {
  const parts: string[] = [];
  let current = "";
  const lines = diff.split("\n");
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (current.trim().length > 0) parts.push(current.trim());
      current = `${line}\n`;
    } else {
      current += `${line}\n`;
    }
  }
  if (current.trim().length > 0) parts.push(current.trim());
  return parts;
};

export const buildCompactSummary = async (
  excludeFiles?: string[],
  maxFiles: number = 20,
) => {
  const summary = await getDiffSummary(excludeFiles);
  if (!summary) return null;
  const { fileStats } = summary;
  const sorted = [...fileStats].sort((a, b) => b.changes - a.changes);
  const top = sorted.slice(0, Math.max(1, maxFiles));
  const totalFiles = summary.files.length;
  const totalChanges = summary.totalChanges;
  const totalAdditions = fileStats.reduce((s, f) => s + (f.additions || 0), 0);
  const totalDeletions = fileStats.reduce((s, f) => s + (f.deletions || 0), 0);

  const lines: string[] = [];
  lines.push(`Files changed: ${totalFiles}`);
  lines.push(
    `Additions: ${totalAdditions}, Deletions: ${totalDeletions}, Total changes: ${totalChanges}`,
  );
  lines.push("Top files by changes:");
  for (const f of top) {
    lines.push(
      `- ${f.file} (+${f.additions} / -${f.deletions}, ${f.changes} changes)`,
    );
  }
  if (sorted.length > top.length) {
    lines.push(`…and ${sorted.length - top.length} more files`);
  }

  return lines.join("\n");
};

export interface Commit {
  hash: string;
  message: string;
  body: string;
}

export const getCurrentBranch = async (): Promise<string> => {
  const { stdout } = await execa("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  return stdout.trim();
};

export const getUpstreamBranch = async (): Promise<string | null> => {
  try {
    const { stdout } = await execa("git", [
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "@{u}",
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
};

export const getDefaultRemote = async (): Promise<string> => {
  const { stdout: remotes } = await execa("git", ["remote"]);
  return remotes.split("\n")[0]?.trim() || "origin";
};

export const getBaseBranch = async (): Promise<string> => {
  const { stdout: remotes } = await execa("git", ["remote"]);
  const remote = remotes.split("\n")[0]?.trim() || "origin";

  for (const branch of ["main", "master", "develop"]) {
    try {
      await execa("git", ["rev-parse", "--verify", `${remote}/${branch}`], {
        reject: true,
      });
      return branch;
    } catch {}
  }

  try {
    const { stdout } = await execa("git", [
      "symbolic-ref",
      `refs/remotes/${remote}/HEAD`,
    ]);
    const defaultBranch = stdout.trim().replace(`refs/remotes/${remote}/`, "");
    return defaultBranch;
  } catch {
    return "main";
  }
};

export const getCommitsSinceBase = async (
  baseBranch: string,
): Promise<Commit[]> => {
  const { stdout: remotes } = await execa("git", ["remote"]);
  const remote = remotes.split("\n")[0]?.trim() || "origin";

  try {
    const { stdout } = await execa("git", [
      "log",
      `${remote}/${baseBranch}..HEAD`,
      "--pretty=format:%H|||%s|||%b---COMMIT_END---",
    ]);

    if (!stdout.trim()) {
      return [];
    }

    const commits = stdout
      .split("---COMMIT_END---")
      .filter((c) => c.trim())
      .map((entry) => {
        const [hash, message, ...bodyParts] = entry.trim().split("|||");
        return {
          hash: hash || "",
          message: message || "",
          body: bodyParts.join("|||").trim(),
        };
      })
      .filter((c) => c.hash && c.message);

    return commits;
  } catch {
    return [];
  }
};

export const isGhInstalled = async (): Promise<boolean> => {
  try {
    await execa("gh", ["--version"]);
    return true;
  } catch {
    return false;
  }
};

export const isGhEnabled = async (): Promise<boolean> => {
  const config = await getConfig({}, true);
  return config.gh_enabled;
};

export const assertGhInstalled = async (): Promise<void> => {
  const ghEnabled = await isGhEnabled();
  if (!ghEnabled) {
    throw new KnownError(
      "GitHub CLI features are disabled.\n" +
        "Run `dash setup` to enable them.",
    );
  }

  const installed = await isGhInstalled();
  if (!installed) {
    throw new KnownError(
      "GitHub CLI (gh) is not installed or not in PATH.\n" +
        "Install it from: https://cli.github.com/\n" +
        "Then run `dash setup` to configure.",
    );
  }
};

export interface ExistingPR {
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
}

export const getExistingPR = async (): Promise<ExistingPR | null> => {
  try {
    const { stdout } = await execa("gh", [
      "pr",
      "view",
      "--json",
      "number,title,body,url,state",
    ]);
    return JSON.parse(stdout);
  } catch {
    return null;
  }
};

export const assertNotOnBaseBranch = async (
  currentBranch: string,
  baseBranch: string,
): Promise<void> => {
  if (
    currentBranch === baseBranch ||
    currentBranch === "main" ||
    currentBranch === "master"
  ) {
    throw new KnownError(
      `Cannot create PR from ${currentBranch} branch.\n` +
        "Please switch to a feature branch first.",
    );
  }
};

export const getDiffStatsSinceBase = async (
  baseBranch: string,
): Promise<{ files: number; insertions: number; deletions: number }> => {
  const { stdout: remotes } = await execa("git", ["remote"]);
  const remote = remotes.split("\n")[0]?.trim() || "origin";

  try {
    const { stdout } = await execa("git", [
      "diff",
      "--shortstat",
      `${remote}/${baseBranch}...HEAD`,
    ]);

    const filesMatch = stdout.match(/(\d+) files? changed/);
    const insertionsMatch = stdout.match(/(\d+) insertions?\(\+\)/);
    const deletionsMatch = stdout.match(/(\d+) deletions?\(-\)/);

    return {
      files: filesMatch ? parseInt(filesMatch[1], 10) : 0,
      insertions: insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0,
      deletions: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0,
    };
  } catch {
    return { files: 0, insertions: 0, deletions: 0 };
  }
};

export const buildCompactSummarySinceBase = async (
  baseBranch: string,
  excludeFiles?: string[],
  maxFiles: number = 20,
) => {
  const { stdout: remotes } = await execa("git", ["remote"]);
  const remote = remotes.split("\n")[0]?.trim() || "origin";

  try {
    const { stdout: files } = await execa("git", [
      "diff",
      "--name-only",
      `${remote}/${baseBranch}...HEAD`,
      "--",
      ".",
      ...filesToExclude,
      ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
    ]);

    const fileList = files
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    if (fileList.length === 0) return null;

    const fileStats = await Promise.all(
      fileList.map(async (file) => {
        try {
          const { stdout: stat } = await execa("git", [
            "diff",
            "--numstat",
            `${remote}/${baseBranch}...HEAD`,
            "--",
            file,
          ]);
          const [additions, deletions] = stat
            .split("\t")
            .slice(0, 2)
            .map(Number);
          return {
            file,
            additions: additions || 0,
            deletions: deletions || 0,
            changes: (additions || 0) + (deletions || 0),
          };
        } catch {
          return { file, additions: 0, deletions: 0, changes: 0 };
        }
      }),
    );

    const sorted = [...fileStats].sort((a, b) => b.changes - a.changes);
    const top = sorted.slice(0, Math.max(1, maxFiles));
    const totalAdditions = fileStats.reduce(
      (s, f) => s + (f.additions || 0),
      0,
    );
    const totalDeletions = fileStats.reduce(
      (s, f) => s + (f.deletions || 0),
      0,
    );

    const lines: string[] = [];
    lines.push(`Files changed: ${fileList.length}`);
    lines.push(`Additions: ${totalAdditions}, Deletions: ${totalDeletions}`);
    lines.push("Top files by changes:");
    for (const f of top) {
      lines.push(
        `- ${f.file} (+${f.additions} / -${f.deletions}, ${f.changes} changes)`,
      );
    }
    if (sorted.length > top.length) {
      lines.push(`…and ${sorted.length - top.length} more files`);
    }

    return lines.join("\n");
  } catch {
    return null;
  }
};

export interface RepoInfo {
  owner: string;
  name: string;
  fullName: string;
  isFork: boolean;
  parent?: {
    owner: string;
    name: string;
    fullName: string;
  };
}

export const getRepoInfo = async (): Promise<RepoInfo | null> => {
  try {
    const { stdout } = await execa("gh", [
      "repo",
      "view",
      "--json",
      "owner,name,isFork,parent",
    ]);
    const data = JSON.parse(stdout);
    return {
      owner: data.owner?.login || "",
      name: data.name || "",
      fullName: `${data.owner?.login}/${data.name}`,
      isFork: data.isFork || false,
      parent: data.parent
        ? {
            owner: data.parent.owner?.login || "",
            name: data.parent.name || "",
            fullName: `${data.parent.owner?.login}/${data.parent.name}`,
          }
        : undefined,
    };
  } catch {
    return null;
  }
};

export const getUpstreamRepo = async (): Promise<string | null> => {
  const repoInfo = await getRepoInfo();
  if (repoInfo?.isFork && repoInfo.parent) {
    return repoInfo.parent.fullName;
  }
  return null;
};
