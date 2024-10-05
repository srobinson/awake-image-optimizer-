// src/types/index.ts
export interface Job {
  id: string;
  parent_id: string;
  parent_grid: string;
  username: string;
  full_command: string;
}

export interface Config {
  downloadDir: string;
  likesDir: string;
  optimizedWidths: number[];
  concurrentJobs: number;
  downloadDelay: number;
  jpegQuality: number;
}
