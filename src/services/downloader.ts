// src/services/downloader.ts
import path from 'path';
import { Job } from '../types';
import { makeRequest } from '../utils/browser';
import { fileExists, writeFile } from '../utils/file';
import { embedMetadata } from './metadata';
import { processImage } from './processor';
import config from '../config';

export async function downloadAndProcessImage(job: Job): Promise<boolean> {
  try {
    if (!(job.parent_id != null && job.parent_grid != null)) {
      throw new Error(`Invalid job data: parent_id or parent_grid is missing for job ${job.id}`);
    }

    const imageUrl = `https://cdn.midjourney.com/${job.parent_id}/0_${job.parent_grid}.png`;
    const fileName = `${job.parent_id}_0_${job.parent_grid}.png`;
    const filePath = path.join(config.downloadDir, 'original', fileName);

    if (await fileExists(filePath)) {
      console.log(`File already exists: ${fileName}`);
      return true;
    }

    const imageBuffer = await makeRequest(imageUrl);

    if (!imageBuffer || imageBuffer.length === 0) {
      console.error(`Failed to download image for job ${job.id}`);
      return false;
    }

    await writeFile(filePath, imageBuffer);

    const originalMetadataResult = await embedMetadata(filePath, job);
    if (!originalMetadataResult) {
      console.warn(`Failed to embed metadata for original image of job ${job.id}`);
    }

    await processImage(filePath, job);

    return true;
  } catch (error) {
    console.error(
      `Error downloading/processing image for job ${job.id}: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}
