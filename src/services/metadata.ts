// src/services/metadata.ts
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { Job } from '../types';
import config from '../config';

const execPromise = util.promisify(exec);

export async function embedMetadata(filePath: string, job: Job): Promise<boolean> {
  try {
    const fullCommand = job.full_command || '';
    const instructionsStart = fullCommand.indexOf(' --');
    let comment =
      instructionsStart !== -1
        ? fullCommand.slice(0, instructionsStart).trim()
        : fullCommand.trim();

    // Escape single quotes and remove newlines
    comment = comment.replace(/'/g, "'\\''").replace(/\n/g, ' ');

    const midjourneyInstructions =
      instructionsStart !== -1 ? fullCommand.slice(instructionsStart).trim() : '';

    const exiftoolCommand = `exiftool -overwrite_original -Author="${job.username}" -Comment='${comment}' -XMP-dc:Description="MidjourneyInstructions: ${midjourneyInstructions}" "${filePath}"`;

    await execPromise(exiftoolCommand);

    // Verify the metadata was written
    const verifyCommand = `exiftool -Author -Comment -XMP-dc:Description "${filePath}"`;
    const { stderr: verifyStderr } = await execPromise(verifyCommand);

    if (verifyStderr) {
      console.error(`Error verifying metadata for ${filePath}: ${verifyStderr}`);
    }

    return true;
  } catch (error) {
    console.error(
      `Error embedding metadata for ${filePath}: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

export async function generateMetadataJSON(): Promise<void> {
  let count = 0;
  try {
    const originalDir = path.join(config.downloadDir, 'original');
    const optimizedDir = path.join(config.downloadDir, 'optimized');
    const files = await fs.readdir(originalDir);
    const imageFiles = files.filter((file) =>
      ['.png', '.jpg', '.jpeg'].includes(path.extname(file).toLowerCase())
    );

    const imagesData = await Promise.all(
      imageFiles.map(async (file) => {
        const originalFilePath = path.join(originalDir, file);
        const { stdout } = await execPromise(`exiftool -json "${originalFilePath}"`);
        const metadata = JSON.parse(stdout)[0];

        const variants: Record<string, { width: number; height: number; filename: string }> = {};

        // Add original variant
        const originalOptimizedPath = path.join(
          optimizedDir,
          path.basename(file, path.extname(file)) + '.jpg'
        );
        const originalImageInfo = await sharp(originalOptimizedPath).metadata();
        variants.original = {
          width: originalImageInfo.width!,
          height: originalImageInfo.height!,
          filename: path.basename(originalOptimizedPath),
        };

        // Add other variants
        for (const width of config.optimizedWidths) {
          const variantPath = path.join(
            optimizedDir,
            width.toString(),
            path.basename(file, path.extname(file)) + '.jpg'
          );
          const variantInfo = await sharp(variantPath).metadata();
          variants[width.toString()] = {
            width: variantInfo.width!,
            height: variantInfo.height!,
            filename: path.basename(variantPath),
          };
        }

        count++;

        return {
          filename: file,
          index: count,
          author: metadata.Author,
          comment: metadata.Comment,
          midjourneyInstructions: metadata.Description?.replace('MidjourneyInstructions: ', ''),
          variants,
        };
      })
    );

    const galleryData = {
      totalImages: imagesData.length,
      images: imagesData.sort((a, b) => {
        return a.index - b.index;
      }),
    };

    const outputPath = path.join(config.downloadDir, 'gallery.json');
    await fs.writeFile(outputPath, JSON.stringify(galleryData, null, 2));

    console.log(`Gallery metadata written to ${outputPath}`);
  } catch (error) {
    console.error(
      'Error generating metadata JSON:',
      error instanceof Error ? error.message : String(error)
    );
  }
}
