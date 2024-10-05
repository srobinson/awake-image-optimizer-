import fs from 'fs/promises';
import path from 'path';
import { Job } from './types';
import config from './config';
import { initBrowser, closeBrowser } from './utils/browser';
import { downloadAndProcessImage } from './services/downloader';
import { generateMetadataJSON } from './services/metadata';
import pLimit from 'p-limit';
import { ensureAllDirectoriesExist } from './utils/file';

async function main() {
  try {
    await ensureAllDirectoriesExist(config);
    await initBrowser();

    const files = await fs.readdir(config.likesDir);
    const jsonFiles = files.filter((file) => path.extname(file).toLowerCase() === '.json');

    let allJobs: Job[] = [];

    for (const file of jsonFiles) {
      const filePath = path.join(config.likesDir, file);
      console.log(`Reading source file: ${filePath}`);

      const jsonContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(jsonContent);
      allJobs = allJobs.concat(data.jobs);
    }

    console.log(`Total jobs to process: ${allJobs.length}`);

    const limit = pLimit(config.concurrentJobs);
    console.log(`Concurrent jobs limit: ${config.concurrentJobs}`);

    const processJob = async (job: Job) => {
      const result = await downloadAndProcessImage(job);
      if (!result) {
        console.log(`Failed to process job ${job.id}`);
      }
      return result;
    };

    console.log('Starting parallel processing...');
    const promises = allJobs.map((job) => limit(() => processJob(job)));

    const results = await Promise.all(promises);

    const successCount = results.filter((result) => result).length;
    const failureCount = results.length - successCount;

    console.log(`Completed processing all jobs:`);
    console.log(`  Successfully processed: ${successCount} jobs`);
    console.log(`  Failed to process: ${failureCount} jobs`);

    console.log('Processing completed successfully.');

    // Generate the gallery.json file
    await generateMetadataJSON();

    console.log('All tasks completed. Closing browser...');
  } catch (error) {
    console.error('An error occurred:', error instanceof Error ? error.message : String(error));
  } finally {
    try {
      await closeBrowser();
      console.log('Browser closed successfully.');
    } catch (closeError) {
      console.error(
        'Error closing browser:',
        closeError instanceof Error ? closeError.message : String(closeError)
      );
    }
    console.log('Script execution finished.');
  }
}

main().catch((error) =>
  console.error('Unhandled error:', error instanceof Error ? error.message : String(error))
);
