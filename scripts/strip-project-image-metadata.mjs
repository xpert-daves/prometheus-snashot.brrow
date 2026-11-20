#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const PORTFOLIO_DIR = path.resolve("public/portfolio");
const JPEG_EXTENSION = /\.jpe?g$/i;
const STRIPPED_MARKERS = new Set([
  0xe1, // APP1: EXIF/XMP, including GPS tags
  0xed, // APP13: IPTC metadata
  0xfe, // JPEG comment
]);

async function listJpegs(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listJpegs(absolutePath)));
    } else if (entry.isFile() && JPEG_EXTENSION.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files.sort();
}

export function stripJpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error("Expected a JPEG file with an SOI marker");
  }

  const chunks = [buffer.subarray(0, 2)];
  let offset = 2;
  let changed = false;

  while (offset < buffer.length) {
    const markerStart = offset;
    if (buffer[offset] !== 0xff) {
      throw new Error(`Invalid JPEG marker at byte ${offset}`);
    }

    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;

    // Start of scan: the remaining bytes are entropy-coded image data.
    if (marker === 0xda) {
      chunks.push(buffer.subarray(markerStart));
      offset = buffer.length;
      break;
    }

    // Standalone markers do not carry a two-byte segment length.
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      chunks.push(buffer.subarray(markerStart, offset));
      if (marker === 0xd9) offset = buffer.length;
      continue;
    }

    if (offset + 2 > buffer.length) {
      throw new Error(`Truncated JPEG segment at byte ${markerStart}`);
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2) {
      throw new Error(`Invalid JPEG segment length at byte ${markerStart}`);
    }

    const segmentEnd = offset + segmentLength;
    if (segmentEnd > buffer.length) {
      throw new Error(`JPEG segment exceeds file length at byte ${markerStart}`);
    }

    if (STRIPPED_MARKERS.has(marker)) {
      changed = true;
    } else {
      chunks.push(buffer.subarray(markerStart, segmentEnd));
    }
    offset = segmentEnd;
  }

  return {
    changed,
    buffer: changed ? Buffer.concat(chunks) : buffer,
  };
}

async function main() {
  const checkOnly = process.argv.includes("--check");
  const files = await listJpegs(PORTFOLIO_DIR);
  const filesWithMetadata = [];

  for (const file of files) {
    const original = await fs.readFile(file);
    const result = stripJpegMetadata(original);
    if (!result.changed) continue;

    filesWithMetadata.push(path.relative(process.cwd(), file));
    if (!checkOnly) await fs.writeFile(file, result.buffer);
  }

  if (checkOnly && filesWithMetadata.length > 0) {
    throw new Error(
      `Project image metadata found in: ${filesWithMetadata.join(", ")}. Run pnpm prebuild to strip it.`
    );
  }

  if (filesWithMetadata.length > 0) {
    console.log(`Stripped metadata from ${filesWithMetadata.length} project image(s).`);
  } else {
    console.log(`Project image metadata check passed (${files.length} JPEGs).`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
