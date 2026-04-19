import { describe, expect, it } from "vitest";
import {
  buildGitCommitArgs,
  buildSingleCommitPrompt,
  formatCommentedCommitMessage,
  splitCommitMessage,
} from "~/commands/commit.js";
import { parseChangedFiles } from "~/utils/git.js";

describe("commit helpers", () => {
  it("includes user message context in the AI prompt", async () => {
    const prompt = await buildSingleCommitPrompt(
      [],
      "Files changed: 1",
      72,
      null,
      "chore: hide testimonials",
    );

    expect(prompt).toContain("USER CONTEXT");
    expect(prompt).toContain("chore: hide testimonials");
    expect(prompt).toContain("never override the actual diff");
  });

  it("allows multi-line commit messages with bullet points for broad diffs", async () => {
    const prompt = await buildSingleCommitPrompt(
      ["src/index.ts", "README.md"],
      "Files changed: 2",
      72,
      null,
    );

    expect(prompt).toContain(
      "If the changes are broad and cover multiple distinct areas",
    );
    expect(prompt).toContain("- change 1");
    expect(prompt).toContain(
      "Return only the commit message, no explanations.",
    );
  });

  it("parses renamed and untracked files from git status output", () => {
    const files = parseChangedFiles("RD new.txt\0old.txt\0?? notes.md\0");

    expect(files).toEqual([
      {
        path: "new.txt",
        originalPath: "old.txt",
        indexStatus: "R",
        worktreeStatus: "D",
        staged: true,
        unstaged: true,
        untracked: false,
        pathspecs: ["new.txt", "old.txt"],
      },
      {
        path: "notes.md",
        originalPath: undefined,
        indexStatus: "?",
        worktreeStatus: "?",
        staged: false,
        unstaged: true,
        untracked: true,
        pathspecs: ["notes.md"],
      },
    ]);
  });

  it("splits multi-line commit messages into subject and body", () => {
    expect(
      splitCommitMessage(
        "refactor: update commit flow\n\n- add staged file selector\n- preserve bullet bodies",
      ),
    ).toEqual({
      subject: "refactor: update commit flow",
      body: "- add staged file selector\n- preserve bullet bodies",
    });
  });

  it("builds git commit args for subject and body", () => {
    expect(
      buildGitCommitArgs(
        "refactor: update commit flow\n\n- add staged file selector\n- preserve bullet bodies",
      ),
    ).toEqual([
      "commit",
      "-m",
      "refactor: update commit flow",
      "-m",
      "- add staged file selector\n- preserve bullet bodies",
    ]);
  });

  it("comments every line in a multi-line hook suggestion", () => {
    expect(
      formatCommentedCommitMessage(
        "refactor: update commit flow\n\n- add staged file selector",
      ),
    ).toBe("# refactor: update commit flow\n#\n# - add staged file selector");
  });
});
