// src/config/index.ts
import { Config } from '../types';

const config: Config = {
  downloadDir: './downloads',
  likesDir: './likes',
  optimizedWidths: [320, 640, 1024, 1920],
  concurrentJobs: 10,
  downloadDelay: 250,
  jpegQuality: 60,
};

export default config;
