"use client";

import * as React from "react";

import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { FigmaWrapper } from "~/components/figma-wrapper";

import { cn } from "~/styles/utils";

export function InstallCommand() {
  const [copied, setCopied] = React.useState(false);

  const command = "npm install -g dash-git";

  const handleCopy = () => {
    navigator.clipboard
      .writeText(command)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <FigmaWrapper>
      <h1
        className="text-muted-foreground group relative inline-flex w-full cursor-pointer items-center p-2 pr-8 font-mono text-sm tracking-tight transition-colors hover:text-foreground"
        onClick={handleCopy}
      >
        npm install -g&nbsp;
        <span className="text-foreground">dash-git</span>
        <span
          className={cn(
            "absolute right-2 ml-4 inline-flex items-center transition-opacity",
          )}
        >
          <div
            className={cn(
              "inset-0 transform transition-all duration-300",
              copied ? "scale-0 opacity-0" : "scale-100 opacity-100",
            )}
          >
            <HugeiconsIcon
              className="text-muted-foreground/50 size-4"
              icon={Copy01Icon}
              strokeWidth={1.5}
            />
          </div>
          <div
            className={cn(
              "absolute transform transition-all duration-300",
              copied ? "scale-100 opacity-100" : "scale-0 opacity-0",
            )}
          >
            <HugeiconsIcon
              className="text-muted-foreground/50 size-4"
              icon={Tick02Icon}
              strokeWidth={1.5}
            />
          </div>
        </span>
      </h1>
    </FigmaWrapper>
  );
}
