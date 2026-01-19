import * as fs from "node:fs";
import * as path from "node:path";
import type { ParsedSource } from "./types.js";

const GITHUB_SHORTHAND_REGEX = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const GITHUB_URL_REGEX =
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/]+)(?:\/tree\/([^/]+)\/(.+))?/;
const GITLAB_URL_REGEX =
  /^https?:\/\/(?:www\.)?gitlab\.com\/([^/]+)\/([^/]+)(?:\/-\/tree\/([^/]+)\/(.+))?/;

export function parseSource(source: string): ParsedSource {
  // Check for local path first
  if (source.startsWith("./") || source.startsWith("/") || source.startsWith("..")) {
    const absolutePath = path.isAbsolute(source)
      ? source
      : path.resolve(process.cwd(), source);

    if (fs.existsSync(absolutePath)) {
      return {
        type: "local",
        localPath: absolutePath,
      };
    }
  }

  // Check for GitHub shorthand (owner/repo)
  if (GITHUB_SHORTHAND_REGEX.test(source)) {
    const [owner, repo] = source.split("/");
    return {
      type: "github",
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}.git`,
    };
  }

  // Check for GitHub URL
  const githubMatch = source.match(GITHUB_URL_REGEX);
  if (githubMatch) {
    const [, owner, repo, branch, subpath] = githubMatch;
    const cleanRepo = repo.replace(/\.git$/, "");
    return {
      type: "github",
      owner,
      repo: cleanRepo,
      branch: branch || undefined,
      subpath: subpath || undefined,
      url: `https://github.com/${owner}/${cleanRepo}.git`,
    };
  }

  // Check for GitLab URL
  const gitlabMatch = source.match(GITLAB_URL_REGEX);
  if (gitlabMatch) {
    const [, owner, repo, branch, subpath] = gitlabMatch;
    const cleanRepo = repo.replace(/\.git$/, "");
    return {
      type: "gitlab",
      owner,
      repo: cleanRepo,
      branch: branch || undefined,
      subpath: subpath || undefined,
      url: `https://gitlab.com/${owner}/${cleanRepo}.git`,
    };
  }

  // Check for generic git URL
  if (source.includes(".git") || source.startsWith("git@") || source.startsWith("git://")) {
    return {
      type: "git",
      url: source,
    };
  }

  // Try to handle as a local path if it exists
  const resolved = path.resolve(process.cwd(), source);
  if (fs.existsSync(resolved)) {
    return {
      type: "local",
      localPath: resolved,
    };
  }

  // Default to treating as a potential git URL
  return {
    type: "git",
    url: source.endsWith(".git") ? source : `${source}.git`,
  };
}
