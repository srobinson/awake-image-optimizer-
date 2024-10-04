const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const config = require("./config");
const { makeRequest, initBrowser, closeBrowser } = require("./requestUtil");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

let pLimit;
let count = 0;

async function importPLimit() {
  const pLimitModule = await import("p-limit");
  pLimit = pLimitModule.default;
}

async function ensureDirectories() {
  const dirs = [
    config.downloadDir,
    path.join(config.downloadDir, "original"),
    path.join(config.downloadDir, "optimized"),
    ...config.optimizedWidths.map((width) =>
      path.join(config.downloadDir, "optimized", width.toString())
    ),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function embedMetadata(filePath, job) {
  try {
    const fullCommand = job.full_command || "";
    const instructionsStart = fullCommand.indexOf(" --");
    let comment =
      instructionsStart !== -1
        ? fullCommand.slice(0, instructionsStart).trim()
        : fullCommand.trim();

    // Escape single quotes and remove newlines
    comment = comment.replace(/'/g, "'\\''").replace(/\n/g, " ");

    const midjourneyInstructions =
      instructionsStart !== -1
        ? fullCommand.slice(instructionsStart).trim()
        : "";

    const exiftoolCommand = `exiftool -overwrite_original -Author="${job.username}" -Comment='${comment}' -XMP-dc:Description="MidjourneyInstructions: ${midjourneyInstructions}" "${filePath}"`;

    await execPromise(exiftoolCommand);

    // Verify the metadata was written
    const verifyCommand = `exiftool -Author -Comment -XMP-dc:Description "${filePath}"`;
    const { stderr: verifyStderr } = await execPromise(verifyCommand);

    if (verifyStderr) {
      console.error(
        `Error verifying metadata for ${filePath}: ${verifyStderr}`
      );
    }

    return true;
  } catch (error) {
    console.error(`Error embedding metadata for ${filePath}: ${error.message}`);
    return false;
  }
}

async function processImage(filePath, job) {
  const baseName = path.basename(filePath, ".png");
  const optimizedDir = path.join(config.downloadDir, "optimized");

  count++;
  console.log(`Processing image [${count}] ${filePath}`);

  try {
    const image = sharp(filePath);

    // Save optimized original
    const optimizedPath = path.join(optimizedDir, `${baseName}.jpg`);
    await image.jpeg({ quality: config.jpegQuality }).toFile(optimizedPath);

    // Embed metadata in optimized original
    await embedMetadata(optimizedPath, job);

    // Create device-optimized versions
    for (const width of config.optimizedWidths) {
      const resizedPath = path.join(
        optimizedDir,
        width.toString(),
        `${baseName}.jpg`
      );
      await image
        .resize(width)
        .jpeg({ quality: config.jpegQuality })
        .toFile(resizedPath);

      // Embed metadata in resized version
      await embedMetadata(resizedPath, job);
    }
  } catch (error) {
    console.error(`Error processing image ${filePath}: ${error.message}`);
  }
}

async function downloadAndProcessImage(job) {
  try {
    if (!(job.parent_id != null && job.parent_grid != null)) {
      console.error(
        `Invalid job data: parent_id or parent_grid is missing for job ${job.id}`
      );
      return false;
    }

    const imageUrl = `https://cdn.midjourney.com/${job.parent_id}/0_${job.parent_grid}.png`;
    const fileName = `${job.parent_id}_0_${job.parent_grid}.png`;
    const filePath = path.join(config.downloadDir, "original", fileName);

    // Check if file already exists
    try {
      await fs.access(filePath);
      console.log(`File already exists: ${fileName}`);
      return true;
    } catch (error) {
      // File doesn't exist, proceed with download
    }

    const imageBuffer = await makeRequest(imageUrl);

    if (!imageBuffer || imageBuffer.length === 0) {
      console.error(`Failed to download image for job ${job.id}`);
      return false;
    }

    await fs.writeFile(filePath, imageBuffer);

    const originalMetadataResult = await embedMetadata(filePath, job);
    if (!originalMetadataResult) {
      console.error(
        `Failed to embed metadata for original image of job ${job.id}`
      );
    }

    await processImage(filePath, job);

    return true;
  } catch (error) {
    console.error(
      `Error downloading/processing image for job ${job.id}: ${error.message}`
    );
    return false;
  }
}

async function generateMetadataJSON() {
  const originalDir = path.join(config.downloadDir, "original");
  const optimizedDir = path.join(config.downloadDir, "optimized");
  const outputPath = path.join(config.downloadDir, "gallery.json");

  // Read all files in the original directory
  const files = await fs.readdir(originalDir);

  // Filter for .png files in the original directory
  const imageFiles = files
    .filter((file) => path.extname(file).toLowerCase() === ".png")
    .sort(
      (a, b) =>
        parseInt(path.basename(a, ".png")) - parseInt(path.basename(b, ".png"))
    );

  const renameFields = (obj) => {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "SourceFile") continue; // Skip SourceFile
      switch (key) {
        case "FileSize":
          newObj["size"] = value.replace(" kB", "");
          break;
        case "FileName":
          newObj["name"] = value;
          break;
        case "ImageWidth":
          newObj["width"] = value;
          break;
        case "ImageHeight":
          newObj["height"] = value;
          break;
        default:
          newObj[key.toLowerCase()] = value;
      }
    }
    return newObj;
  };

  const imagesData = await Promise.all(
    imageFiles.map(async (file, index) => {
      const originalFilePath = path.join(originalDir, file);

      // Extract metadata for the original image
      const { stdout: originalMetadata } = await execPromise(
        `exiftool -json -Author -Comment -Description -ImageWidth -ImageHeight -FileSize -FileModifyDate -FileName "${originalFilePath}"`
      );
      const originalMetadataObj = JSON.parse(originalMetadata)[0];

      // Extract the modified date
      const modifiedDate = originalMetadataObj.FileModifyDate;

      // Process the Description field
      let description = originalMetadataObj.Description || "";
      description = description.trim();
      const descriptionField =
        description !== "MidjourneyInstructions:"
          ? { description: description }
          : {};

      // Get metadata for each size variant
      const sizeVariants = {};
      for (const width of config.optimizedWidths) {
        const optimizedFileName = path.basename(file, ".png") + ".jpg";
        const sizeFilePath = path.join(
          optimizedDir,
          width.toString(),
          optimizedFileName
        );
        try {
          await fs.access(sizeFilePath);
          const { stdout: sizeMetadata } = await execPromise(
            `exiftool -json -FileSize -FileName -ImageWidth -ImageHeight "${sizeFilePath}"`
          );
          let variantMetadata = JSON.parse(sizeMetadata)[0];
          sizeVariants[width] = renameFields(variantMetadata);
        } catch (error) {
          console.log(`Size variant not found: ${width} for file ${file}`);
          console.log(`Attempted path: ${sizeFilePath}`);
        }
      }

      return {
        index: index,
        filename: file,
        modified: modifiedDate,
        author: originalMetadataObj.Author,
        comment: originalMetadataObj.Comment,
        ...descriptionField,
        variants: {
          original: renameFields({
            Width: originalMetadataObj.ImageWidth,
            Height: originalMetadataObj.ImageHeight,
            FileSize: originalMetadataObj.FileSize,
            FileName: originalMetadataObj.FileName,
          }),
          ...sizeVariants,
        },
      };
    })
  );

  const galleryData = {
    totalimages: imagesData.length,
    images: imagesData,
  };

  // Write the gallery.json file
  await fs.writeFile(outputPath, JSON.stringify(galleryData, null, 2));

  console.log(`Gallery metadata written to ${outputPath}`);
}

async function main() {
  try {
    await importPLimit();
    await ensureDirectories();
    await initBrowser(); // Initialize the browser

    const files = await fs.readdir(config.likesDir);
    const jsonFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".json"
    );

    let allJobs = [];

    for (const file of jsonFiles) {
      const filePath = path.join(config.likesDir, file);
      console.log(`Reading source file: ${filePath}`);

      const jsonContent = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(jsonContent);
      allJobs = allJobs.concat(data.jobs);
    }

    console.log(`Total jobs to process: ${allJobs.length}`);

    const limit = pLimit(config.concurrentJobs);
    console.log(`Concurrent jobs limit: ${config.concurrentJobs}`);

    const processJob = async (job) => {
      const result = await downloadAndProcessImage(job);
      if (!result) {
        console.log(`Failed to process job ${job.id}`);
      }
      return result;
    };

    console.log("Starting parallel processing...");
    const promises = allJobs.map((job) => limit(() => processJob(job)));

    const results = await Promise.all(promises);

    const successCount = results.filter((result) => result).length;
    const failureCount = results.length - successCount;

    console.log(`Completed processing all jobs:`);
    console.log(`  Successfully processed: ${successCount} jobs`);
    console.log(`  Failed to process: ${failureCount} jobs`);

    console.log("Processing completed successfully.");

    // Generate the gallery.json file
    await generateMetadataJSON();

    console.log("All tasks completed. Closing browser...");
  } catch (error) {
    console.error("An error occurred:", error.message);
  } finally {
    try {
      await closeBrowser(); // Close the browser
      console.log("Browser closed successfully.");
    } catch (closeError) {
      console.error("Error closing browser:", closeError.message);
    }
    console.log("Script execution finished.");
  }
}

main()
  .catch((error) => console.error("Unhandled error:", error))
  .finally(() => {
    console.log("Forcing process exit...");
    process.exit(0);
  });
