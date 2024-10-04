const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Define input and output directories
const inputDir = "./input"; // Directory containing source images
const outputDir = "./"; // Directory for optimized images

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Function to process images
async function processImages() {
  const files = fs.readdirSync(inputDir);
  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const outputFilePath = path.join(outputDir, file);

    // Optimize the original image
    await sharp(filePath).jpeg({ quality: 80 }).toFile(outputFilePath);

    // Generate thumbnails in different sizes
    await Promise.all([
      sharp(filePath)
        .resize(150)
        .jpeg({ quality: 80 })
        .toFile(path.join(outputDir, `thumb-150-${file}`)), // 150px thumbnail
      sharp(filePath)
        .resize(300)
        .jpeg({ quality: 80 })
        .toFile(path.join(outputDir, `thumb-300-${file}`)), // 300px thumbnail
      sharp(filePath)
        .resize(600)
        .jpeg({ quality: 80 })
        .toFile(path.join(outputDir, `thumb-600-${file}`)), // 600px thumbnail
      sharp(filePath)
        .resize(800)
        .jpeg({ quality: 80 })
        .toFile(path.join(outputDir, `thumb-600-${file}`)), // 600px thumbnail
    ]);
  }
}

// Execute the processing function
processImages()
  .then(() => console.log("Image processing completed!"))
  .catch((err) => console.error("Error processing images:", err));
