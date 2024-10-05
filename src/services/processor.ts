// src/services/processor.ts
import path from 'path';
import sharp from 'sharp';
import { ensureDirectoryExists } from '../utils/file';
import { Job } from '../types';
import config from '../config';
import { embedMetadata } from './metadata';

export async function processImage(filePath: string, job: Job): Promise<void> {
  const baseName = path.basename(filePath, '.png');
  const optimizedDir = path.join(config.downloadDir, 'optimized');

  console.log(`Processing image ${filePath}`);

  try {
    await ensureDirectoryExists(optimizedDir);

    const image = sharp(filePath);

    // Save optimized original
    const optimizedPath = path.join(optimizedDir, `${baseName}.jpg`);
    await image.jpeg({ quality: config.jpegQuality }).toFile(optimizedPath);

    // Embed metadata in optimized original
    await embedMetadata(optimizedPath, job);

    // Create device-optimized versions
    for (const width of config.optimizedWidths) {
      const resizedDir = path.join(optimizedDir, width.toString());
      await ensureDirectoryExists(resizedDir);
      const resizedPath = path.join(resizedDir, `${baseName}.jpg`);
      await image.resize(width).jpeg({ quality: config.jpegQuality }).toFile(resizedPath);

      // Embed metadata in resized version
      await embedMetadata(resizedPath, job);
    }
  } catch (error) {
    console.error(
      `Error processing image ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
