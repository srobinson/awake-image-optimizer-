const { exec } = require("child_process");
const util = require("util");
const path = require("path");

const execPromise = util.promisify(exec);

async function checkMetadata(filePath) {
  try {
    const { stdout, stderr } = await execPromise(
      `exiftool -json -Author -Comment -MidjourneyInstructions "${filePath}"`
    );
    if (stderr) {
      console.error("Error:", stderr);
      return;
    }

    const metadata = JSON.parse(stdout)[0];

    console.log("Metadata for:", path.basename(filePath));
    console.log("Author:", metadata.Author);
    console.log("Comment:", metadata.Comment);
    console.log("MidjourneyInstructions:", metadata.MidjourneyInstructions);
  } catch (error) {
    console.error("Error executing exiftool:", error.message);
  }
}

// Usage
const imagePath = process.argv[2];
if (!imagePath) {
  console.error("Please provide an image path as an argument");
  process.exit(1);
}

checkMetadata(imagePath);
