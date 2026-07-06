import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
copyFileSync(
  path.join(root, "..", "src", "react", "styles.css"),
  path.join(root, "..", "dist", "styles.css")
);
