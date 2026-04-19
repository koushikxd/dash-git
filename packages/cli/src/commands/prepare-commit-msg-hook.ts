import fs from "node:fs/promises";
import { intro, outro, spinner } from "@clack/prompts";
import { black, green, red, bgCyan } from "kolorist";
import { getStagedDiff, buildCompactSummary } from "~/utils/git.js";
import {
  buildSingleCommitPrompt,
  formatCommentedCommitMessage,
} from "~/commands/commit.js";
import { getConfig } from "~/utils/config.js";
import { generateCommitMessageFromSummary } from "~/utils/groq.js";
import { KnownError, handleCliError } from "~/errors.js";

const [messageFilePath, commitSource] = process.argv.slice(2);

export default () =>
  (async () => {
    if (!messageFilePath) {
      throw new KnownError(
        'Commit message file path is missing. This file should be called from the "prepare-commit-msg" git hook',
      );
    }

    if (commitSource) {
      return;
    }

    const staged = await getStagedDiff();
    if (!staged) {
      return;
    }

    intro(bgCyan(black(" dash ")));

    const { env } = process;
    const config = await getConfig({
      GROQ_API_KEY: env.GROQ_API_KEY,
      proxy:
        env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
    });

    const s = spinner();
    s.start("The AI is analyzing your changes");
    let messages: string[];
    try {
      const compact = await buildCompactSummary();
      if (compact) {
        const enhanced = await buildSingleCommitPrompt(
          staged.files,
          compact,
          config["max-length"],
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

    const baseMessage = await fs.readFile(messageFilePath, "utf8");
    const supportsComments = baseMessage !== "";
    const hasMultipleMessages = messages.length > 1;

    let instructions = "";

    if (supportsComments) {
      instructions = `# 🤖 AI generated commit${
        hasMultipleMessages ? "s" : ""
      }\n`;
    }

    if (hasMultipleMessages) {
      if (supportsComments) {
        instructions +=
          "# Select one of the following messages by uncommeting:\n";
      }
      instructions += `\n${messages
        .map((message) => formatCommentedCommitMessage(message))
        .join("\n#\n")}`;
    } else {
      if (supportsComments) {
        instructions += "# Edit the message below and commit:\n";
      }
      instructions += `\n${messages[0]}\n`;
    }

    await fs.appendFile(messageFilePath, instructions);
    outro(`${green("✔")} Saved commit message!`);
  })().catch((error) => {
    outro(`${red("✖")} ${error.message}`);
    handleCliError(error);
    process.exit(1);
  });
