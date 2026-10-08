import path from "node:path"
import { fileURLToPath } from "node:url"

const directory = path.dirname(fileURLToPath(import.meta.url))
export const dataDirectory = path.resolve(directory, "../data")