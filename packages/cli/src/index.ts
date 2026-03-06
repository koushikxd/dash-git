import { cli } from "cleye";
import { outro } from "@clack/prompts";
import { red } from "kolorist";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import commitCommand from "~/commands/commit.js";
import prCommand from "~/commands/pr.js";
import issueCommand from "~/commands/issue.js";
import configCommand from "~/commands/config.js";
import modelCommand from "~/commands/model.js";
import hookCommand, { isCalledFromGitHook } from "~/commands/hook.js";
import setupCommand from "~/commands/setup.js";
import summaryCommand from "~/commands/summary.js";
import prepareCommitMessageHook from "~/commands/prepare-commit-msg-hook.js";
import { runCommitWithPush } from "~/commands/commit.js";
import { handleCliError } from "~/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8"),
);
const { description, version } = packageJson;

const rawArgv = process.argv.slice(2);

if (isCalledFromGitHook) {
  prepareCommitMessageHook();
} else {
  cli(
    {
      name: "dash",
      version,
      commands: [
        commitCommand,
        prCommand,
        issueCommand,
        configCommand,
        modelCommand,
        hookCommand,
        setupCommand,
        summaryCommand,
      ],
      help: {
        description,
      },
      ignoreArgv: (type) => type === "unknown-flag" || type === "argument",
    },
    async (_argv) => {
      await runCommitWithPush(
        undefined,
        [],
        true,
        undefined,
        rawArgv,
        true,
      ).catch((error) => {
        outro(`${red("×")} ${error.message}`);
        handleCliError(error);
        process.exit(1);
      });
    },
    rawArgv,
  );
}
