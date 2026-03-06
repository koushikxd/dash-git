"use client";

import * as React from "react";
import Link from "next/link";
import * as motion from "motion/react-client";
import type { Route } from "next";

import { InstallCommand } from "~/components/install-command";
import { GithubStars } from "~/components/github-stars";
import { NpmDownloads } from "~/components/npm-downloads";
import { cn } from "~/styles/utils";
import { CLI_VERSION } from "~/lib/constants";

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export default function Page() {
  return (
    <main className="bg-background relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4">
      <div className="relative w-full max-w-3xl">
        <div className="border-border/40 absolute top-0 -left-[100vw] -right-[100vw] h-px border-t" />
        <div className="border-border/40 absolute bottom-0 -left-[100vw] -right-[100vw] h-px border-t" />
        <div className="border-border/40 absolute -top-[100vh] -bottom-[100vh] left-0 w-px border-l" />
        <div className="border-border/40 absolute -top-[100vh] -bottom-[100vh] right-0 w-px border-l" />

        <PlusIcon className="text-muted-foreground absolute -top-2 -left-2 z-10" />
        <PlusIcon className="text-muted-foreground absolute -top-2 -right-2 z-10" />
        <PlusIcon className="text-muted-foreground absolute -bottom-2 -left-2 z-10" />
        <PlusIcon className="text-muted-foreground absolute -bottom-2 -right-2 z-10" />

        <div className="relative z-10 px-8 py-16 text-center md:px-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center gap-6"
          >
            <div className="flex w-full items-center justify-between text-xs font-medium tracking-wider uppercase">
              <span className="text-muted-foreground">
                v{CLI_VERSION} is out!
              </span>
              <div className="text-muted-foreground flex items-center gap-4">
                <React.Suspense fallback={<NpmDownloads />}>
                  <NpmDownloads />
                </React.Suspense>
                <React.Suspense fallback={<GithubStars />}>
                  <GithubStars />
                </React.Suspense>
              </div>
            </div>

            <h1 className="text-foreground max-w-2xl text-3xl font-bold tracking-tight md:text-4xl mt-2">
              Never leave your terminal again
            </h1>

            <div className="mt-4 w-full max-w-md">
              <InstallCommand />
            </div>

            <div className="text-muted-foreground mt-8 flex w-full justify-between font-mono text-sm">
              <Link
                href={"/docs" as Route}
                className="hover:text-foreground transition-colors"
              >
                [docs]
              </Link>
              <div className="flex gap-4">
                <Link
                  href="https://github.com/koushikxd/dash-git"
                  className="hover:text-foreground transition-colors"
                  target="_blank"
                >
                  [github]
                </Link>
                <Link
                  href="https://www.npmjs.com/package/dash-git"
                  className="hover:text-foreground transition-colors"
                  target="_blank"
                >
                  [npm]
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
