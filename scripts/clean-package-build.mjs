import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const repositoryRoot = resolve(".");
const target = resolve(repositoryRoot, "dist");
if (dirname(target) !== repositoryRoot) throw new Error("Refusing to clean a package directory outside the repository root.");
await rm(target, { recursive: true, force: true });
