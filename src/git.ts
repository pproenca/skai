import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { simpleGit } from "simple-git";

const git = simpleGit();

export async function cloneRepo(url: string, branch?: string): Promise<string> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skai-"));

  const options: string[] = ["--depth", "1"];
  if (branch) {
    options.push("--branch", branch);
  }

  await git.clone(url, tempDir, options);

  return tempDir;
}

export function cleanupTempDir(tempDir: string): void {
  // Security: Only cleanup directories within the system temp directory
  const systemTmp = os.tmpdir();
  const resolved = path.resolve(tempDir);

  if (!resolved.startsWith(systemTmp)) {
    throw new Error(`Refusing to cleanup directory outside temp: ${tempDir}`);
  }

  if (!resolved.includes("skai-")) {
    throw new Error(`Refusing to cleanup non-skai temp directory: ${tempDir}`);
  }

  if (fs.existsSync(resolved)) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
