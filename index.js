const fs = require("fs").promises;
const path = require("path");
const sharp = require("sharp");
const exiftool = require("node-exiftool");
const exiftoolBin = require("dist-exiftool");
const config = require("./config");
const { makeRequest } = require("./requestUtil");
const { exec } = require("child_process");
const util = require("util");
const execPromise = util.promisify(exec);

const ep = new exiftool.ExiftoolProcess(exiftoolBin);

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
    const instructionsStart = fullCommand.indexOf("--");
    const midjourneyInstructions =
      instructionsStart !== -1
        ? fullCommand.slice(instructionsStart).trim()
        : "";

    const exiftoolCommand = `exiftool -overwrite_original -Author="${job.username}" -Comment="${fullCommand}" -XMP-dc:Description="MidjourneyInstructions: ${midjourneyInstructions}" "${filePath}"`;

    await execPromise(exiftoolCommand);

    // Verify the metadata was written
    const verifyCommand = `exiftool -Author -Comment -XMP-dc:Description "${filePath}"`;
    const { stdout: verifyStdout, stderr: verifyStderr } = await execPromise(
      verifyCommand
    );

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

  try {
    const image = sharp(filePath);

    // Save optimized original
    const optimizedPath = path.join(optimizedDir, `${baseName}.jpg`);
    await image.jpeg({ quality: 80 }).toFile(optimizedPath);

    // Embed metadata in optimized original
    await embedMetadata(optimizedPath, job);

    // Create device-optimized versions
    for (const width of config.optimizedWidths) {
      const resizedPath = path.join(
        optimizedDir,
        width.toString(),
        `${baseName}_${width}.jpg`
      );
      await image.resize(width).jpeg({ quality: 80 }).toFile(resizedPath);

      // Embed metadata in resized version
      await embedMetadata(resizedPath, job);
    }
  } catch (error) {
    console.error(`Error processing image ${filePath}: ${error.message}`);
  }
}

async function downloadAndProcessImage(job) {
  try {
    const imageUrl = `https://cdn.midjourney.com/${job.parent_id}/0_${job.parent_grid}.png`;
    const fileName = `${job.parent_id}_0_${job.parent_grid}.png`;
    const filePath = path.join(config.downloadDir, "original", fileName);

    const imageBuffer = await makeRequest(imageUrl);
    await fs.writeFile(filePath, imageBuffer);
    await processImage(filePath, job);

    const metadataResult = await embedMetadata(filePath, job);
    if (!metadataResult) {
      console.error(`Failed to embed metadata for job ${job.id}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error(
      `Error downloading/processing image for job ${job.id}: ${error.message}`
    );
    return false;
  }
}

async function main() {
  try {
    await ensureDirectories();

    const files = await fs.readdir(config.likesDir);
    const jsonFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".json"
    );

    for (const file of jsonFiles) {
      const filePath = path.join(config.likesDir, file);
      console.log(`Processing source file: ${filePath}`);

      const jsonContent = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(jsonContent);

      for (const job of data.jobs) {
        const result = await downloadAndProcessImage(job);
        if (result) {
          console.log(`  Successfully processed job ${job.id}`);
        } else {
          console.log(`  Failed to process job ${job.id}`);
        }
      }
    }

    console.log("Processing completed successfully.");
  } catch (error) {
    console.error("An error occurred:", error.message);
  }
}

main();
