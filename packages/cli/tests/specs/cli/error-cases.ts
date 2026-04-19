import { describe, it, expect, afterEach } from "vitest";
import { createFixture, createGit, runDash } from "../../utils.js";

describe("Error cases", () => {
  let fixture: Awaited<ReturnType<typeof createFixture>> | null = null;

  afterEach(async () => {
    if (fixture) {
      await fixture.cleanup();
      fixture = null;
    }
  });

  it("fails on non-Git project", async () => {
    fixture = await createFixture();

    const result = await runDash(fixture.path, ["commit"], { reject: false });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(
      "The current directory must be a Git repository!",
    );
  });

  it("fails on no staged files", async () => {
    fixture = await createFixture();
    await createGit(fixture.path);

    const result = await runDash(fixture.path, ["commit"], { reject: false });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain(
      "No changes to commit. Your working tree is clean.",
    );
  });
});
