import { command } from "cleye";
import { cyan, green, dim, bold, yellow } from "kolorist";
import { getConfig, setConfigs } from "~/utils/config.js";
import { handleCliError } from "~/errors.js";
import * as p from "@clack/prompts";

const GROQ_MODELS_URL = "https://console.groq.com/docs/models";

const popularModels = [
  {
    value: "openai/gpt-oss-120b",
    label: "GPT OSS 120B",
    hint: "Best overall",
  },
  {
    value: "openai/gpt-oss-20b",
    label: "GPT OSS 20B",
    hint: "Default fast + capable",
  },
  {
    value: "qwen/qwen3-32b",
    label: "Qwen3 32B",
    hint: "Reasoning and coding",
  },
  {
    value: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B 16E",
    hint: "Vision + tool use",
  },
  {
    value: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile",
    hint: "Strong general purpose",
  },
  {
    value: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    hint: "Fastest production model",
  },
];

export default command(
  {
    name: "model",
    parameters: ["[action]", "[model-name]"],
    help: {
      description: "View or change the AI model used for generation",
      examples: [
        "dash model",
        "dash model set openai/gpt-oss-120b",
        "dash model list",
      ],
    },
  },
  (argv) => {
    (async () => {
      const { action, modelName } = argv._;
      const config = await getConfig({}, true);
      const currentModel = config.model || "openai/gpt-oss-20b";

      if (action === "list") {
        console.log();
        console.log(bold("Available Models:"));
        console.log();
        for (const model of popularModels) {
          const isCurrent = model.value === currentModel;
          const prefix = isCurrent ? green("● ") : "  ";
          const hint = model.hint ? dim(` (${model.hint})`) : "";
          const current = isCurrent ? cyan(" ← current") : "";
          console.log(`${prefix}${model.label}${hint}${current}`);
          console.log(dim(`    ${model.value}`));
        }
        console.log();
        console.log(dim("Browse all models: ") + cyan(GROQ_MODELS_URL));
        console.log();
        return;
      }

      if (action === "set" && modelName) {
        await setConfigs([["model", modelName]]);
        console.log();
        console.log(`${green("✓")} Model set to ${cyan(modelName)}`);
        console.log();
        return;
      }

      p.intro(bold("Model Configuration"));

      console.log();
      console.log(`Current model: ${cyan(currentModel)}`);
      console.log();
      console.log(dim("Browse all available models:"));
      console.log(yellow(GROQ_MODELS_URL));
      console.log();

      const selection = await p.select({
        message: "Choose a model or enter custom",
        options: [
          ...popularModels.map((m) => ({
            value: m.value,
            label: `${m.label} ${
              m.value === currentModel ? cyan("(current)") : ""
            }`,
            hint: m.hint,
          })),
          {
            value: "__custom__",
            label: "Enter custom model ID",
            hint: "From Groq docs",
          },
          {
            value: "__cancel__",
            label: "Keep current model",
            hint: "No changes",
          },
        ],
      });

      if (p.isCancel(selection) || selection === "__cancel__") {
        p.outro("No changes made");
        return;
      }

      let newModel = selection as string;

      if (selection === "__custom__") {
        const customModel = await p.text({
          message: "Enter model ID from Groq",
          placeholder: "e.g., openai/gpt-oss-120b",
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return "Model ID is required";
            }
          },
        });

        if (p.isCancel(customModel)) {
          p.outro("No changes made");
          return;
        }

        newModel = customModel as string;
      }

      if (newModel === currentModel) {
        p.outro(`Already using ${cyan(newModel)}`);
        return;
      }

      await setConfigs([["model", newModel]]);

      p.outro(`${green("✓")} Model changed to ${cyan(newModel)}`);
    })().catch((error) => {
      handleCliError(error);
      process.exit(1);
    });
  },
);
