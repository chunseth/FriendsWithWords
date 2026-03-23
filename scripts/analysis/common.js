#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

require("@babel/register")({
  extensions: [".js"],
  ignore: [/node_modules/],
});

const parseArgs = (argv = []) => {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index];
    if (!raw.startsWith("--")) continue;

    const key = raw.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }

  return result;
};

const resolveFile = (inputPath) => {
  if (!inputPath) return null;
  if (path.isAbsolute(inputPath)) return inputPath;
  return path.resolve(process.cwd(), inputPath);
};

const readJsonFile = (inputPath) => {
  const filePath = resolveFile(inputPath);
  if (!filePath) {
    throw new Error("input path is required");
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const writeJsonOutput = ({ payload, outputPath = null }) => {
  const serialized = JSON.stringify(payload, null, 2);
  if (!outputPath) {
    process.stdout.write(`${serialized}\n`);
    return;
  }

  const resolved = resolveFile(outputPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${serialized}\n`, "utf8");
  process.stdout.write(`Wrote ${resolved}\n`);
};

module.exports = {
  parseArgs,
  readJsonFile,
  writeJsonOutput,
};
