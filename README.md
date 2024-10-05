# Awake Image Optimizer

## Introduction

Awake Image Optimizer is a TypeScript application for processing and optimizing Midjourney AI-generated images. This project is my first experiment with AI-assisted development, using tools like Claude 3.5 and Cursor. It's part of a larger vision to create an immersive gallery showcasing AI-generated art.

## Features

- Downloads and processes Midjourney images
- Converts PNG to JPEG and creates multiple sizes
- Embeds metadata (author, comment, Midjourney instructions)
- Generates a gallery.json file with image metadata
- Implements parallel processing for performance

## Tech Stack

- TypeScript, Node.js
- Puppeteer for web scraping
- Sharp for image processing
- p-limit for concurrency control
- exiftool for metadata manipulation

## Setup and Usage

1. Create a `.env` file with your Midjourney cookie:
   ```
   MIDJOURNEY_COOKIE=your_cookie_string_here
   ```
2. Place Midjourney JSON files in the `likes/` directory
3. Run: `npm run dev`
4. Processed images will be in the `downloads/` directory

## Development

- Make changes in the `src/` directory
- `npm run lint` for code style checks
- `npm run build` to compile TypeScript
- `npm run dev` for development with auto-restart

## Project Recreation Prompt

For those interested in the AI-assisted development process, here's the detailed prompt used to guide the project creation:

````
Create a TypeScript project named "awake-image-optimizer" for processing and optimizing images from Midjourney AI with the following specific requirements:

1. Project Structure:
   ```
   awake-image-optimizer/
   ├── TMP/
   ├── likes/
   ├── src/
   │   ├── config/
   │   ├── services/
   │   ├── types/
   │   └── utils/
   ├── .env
   ├── .gitignore
   ├── package.json
   ├── tsconfig.json
   └── README.md
   ```

2. Dependencies: <--- it's not critical to supply these, but you will leave the AI to decide if you are not explicit.
   - TypeScript
   - Node.js
   - puppeteer (for web scraping)
   - sharp (for image processing)
   - p-limit (for concurrency control)
   - dotenv (for environment variable management)
   - exiftool (for metadata manipulation, called via child_process)
   - ESLint and Prettier for code formatting and linting

3. Configuration (src/config.ts):
   - Define constants for:
     - Download directory paths (original, optimized)
     - Concurrent job limit
     - JPEG quality for optimization
     - Optimized image widths (array of numbers)
   - Load sensitive data from environment variables

4. Types (src/types.ts):
   - Define a Job interface with properties:
     - id: string
     - parent_id: string
     - parent_grid: string
     - username: string
     - full_command: string

5. Services:
   a. Downloader (src/services/downloader.ts):
      - Function to download image from Midjourney CDN
      - Use makeRequest from browser utility
      - Save original PNG file
      - Call metadata and processor services

   b. Metadata (src/services/metadata.ts):
      - Function to embed metadata using exiftool with the following specific tags:
        - Author: Set to the job's username
        - Comment: Set to the part of full_command before any "--" flags
        - XMP-dc:Description: Set to "MidjourneyInstructions: " followed by any "--" flags and subsequent text from full_command
      - Function to generate gallery.json with all image metadata
      - Metadata extraction and conversion process:
        1. Use exiftool to extract metadata as JSON
        2. Convert exiftool tags to gallery.json fields as follows:
           - FileName -> filename
           - Author -> author
           - Comment -> comment
           - Description -> midjourneyInstructions (strip "MidjourneyInstructions: " prefix)
      - Gallery JSON schema:
        ```json
        {
          "totalImages": number,
          "images": [
            {
              "filename": string,
              "author": string,
              "comment": string,
              "midjourneyInstructions": string,
              "variants": {
                "original": {
                  "width": number,
                  "height": number,
                  "filename": string
                },
                "640": {
                  "width": 640,
                  "height": number,
                  "filename": string
                },
                "1024": {
                  "width": 1024,
                  "height": number,
                  "filename": string
                },
                "1920": {
                  "width": 1920,
                  "height": number,
                  "filename": string
                }
              }
            },
            // ... more image objects
          ]
        }
        ```
      - Ensure the gallery.json is written to the config.downloadDir
      - The 'variants' object should include entries for each resized version of the image, with keys corresponding to the width of the variant (e.g., "640", "1024", "1920") and an "original" key for the original optimized version
      - The height of each variant should be calculated to maintain the aspect ratio of the original image
      - When embedding metadata:
        - Escape single quotes in the comment field
        - Remove newlines from the comment field
        - Ensure proper handling of special characters in all fields

   c. Processor (src/services/processor.ts):
      - Function to process images using sharp:
        - Convert PNG to JPEG
        - Create resized versions based on config
        - Save optimized images
      - Call metadata service to embed data in processed images

6. Utilities:
   a. Browser (src/utils/browser.ts):
      - Initialize Puppeteer browser
      - Manage page pool (create, get, release pages)
      - Set up pages with specific headers and user agent
      - Function to make HTTP requests

   b. File (src/utils/file.ts):
      - Functions to ensure directories exist
      - Check file existence
      - Write files with proper error handling

7. Main Process (src/index.ts):
   - Initialize directories and browser
   - Read JSON files from likes directory
   - Parse jobs from JSON files
   - Use p-limit to process jobs in parallel with concurrency control
   - Call downloader service for each job
   - Generate metadata JSON after processing
   - Proper error handling and logging throughout
   - Close browser and finish execution

8. Environment Setup:
   - Use .env file for sensitive data (e.g., MIDJOURNEY_COOKIE)
   - Implement dotenv to load environment variables

9. Error Handling and Logging:
   - Implement try-catch blocks in all async functions
   - Log errors with context (e.g., job ID, file path)
   - Console log processing status and results

10. Performance Considerations:
    - Implement page pooling in browser utility
    - Use streams for large file operations where applicable
    - Parallel processing of jobs with configurable concurrency

11. Code Style and Best Practices:
    - Use async/await for all asynchronous operations
    - Implement proper TypeScript typing throughout
    - Follow ESLint and Prettier configurations
    - Use meaningful variable and function names
    - Add comments for complex logic

12. Documentation:
    - Maintain a detailed README.md with:
      - Project overview
      - Setup instructions
      - Usage guide
      - Configuration options
      - Troubleshooting section

13. Git Management:
    - Use .gitignore to exclude node_modules, .env, and build artifacts
    - Maintain a clean commit history with meaningful commit messages

Implement the project ensuring all components work together seamlessly. The application should be able to process a batch of Midjourney images, optimizing them, adding metadata, and generating a comprehensive gallery JSON, all while handling errors gracefully and providing clear logging output.
````

## Note on Browser Cookies

This project relies on browser cookies for authentication with Midjourney. If you encounter authentication issues:

1. Log into the Midjourney website.
2. Open Developer Tools and go to the Network tab.
3. Find a request to the Midjourney API and copy its cURL command.
4. Extract the cookie value from the cURL command.
5. Update the `MIDJOURNEY_COOKIE` in your `.env` file.

Cookies typically expire, so you may need to repeat this process periodically.

## Project Versions

- **Main Branch**: Current TypeScript implementation
- **[VanillaJS Branch](https://github.com/yourusername/awake-image-optimizer/tree/vanillajs)**: Original JavaScript version

## License

MIT License

## Acknowledgements

Thanks to the teams behind Claude 3.5 and Cursor for their AI-powered development tools.

````
This version maintains the concise overview while including the detailed project recreation prompt, the note about browser cookies, and the information about the VanillaJS branch. It provides a comprehensive yet readable README that covers all the key aspects of your project.
````
