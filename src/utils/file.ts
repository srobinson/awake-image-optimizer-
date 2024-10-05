// src/utils/file.ts
import fs from 'fs/promises';
import path from 'path';

export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch (error) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function ensureAllDirectoriesExist(config: any): Promise<void> {
  await ensureDirectoryExists(config.downloadDir);
  await ensureDirectoryExists(path.join(config.downloadDir, 'original'));
  await ensureDirectoryExists(path.join(config.downloadDir, 'optimized'));
  for (const width of config.optimizedWidths) {
    await ensureDirectoryExists(path.join(config.downloadDir, 'optimized', width.toString()));
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeFile(filePath: string, data: Buffer): Promise<void> {
  await ensureDirectoryExists(path.dirname(filePath));
  await fs.writeFile(filePath, data);
}
