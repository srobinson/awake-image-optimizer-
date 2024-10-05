// src/config/index.ts
import { Config } from '../types';

const config: Config = {
  downloadDir: './downloads',
  likesDir: './likes',
  optimizedWidths: [640, 1024, 1920],
  concurrentJobs: 10,
  downloadDelay: 250,
  jpegQuality: 80,
};

export default config;
