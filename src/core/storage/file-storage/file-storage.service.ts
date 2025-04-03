import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

@Injectable()
export class FileStorageService {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly baseDir: string;

  constructor() {
    this.baseDir = process.env.FILE_STORAGE_PATH || './data';
    this.ensureBaseDirExists();
  }

  /**
   * Ensure base directory exists
   */
  private ensureBaseDirExists(): void {
    try {
      if (!fs.existsSync(this.baseDir)) {
        fs.mkdirSync(this.baseDir, { recursive: true });
        this.logger.log(`Created base directory: ${this.baseDir}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to create base directory: ${this.baseDir}`,
        error,
      );
    }
  }

  /**
   * Save data to a file
   */
  async saveFile(
    filepath: string,
    data: string | Buffer | object,
    options?: { encoding?: string; format?: 'json' | 'text' | 'binary' },
  ): Promise<string> {
    try {
      const fullPath = path.resolve(this.baseDir, filepath);
      const directory = path.dirname(fullPath);

      // Create directory if it doesn't exist
      await fsPromises.mkdir(directory, { recursive: true });

      let fileData: string | Buffer;
      const format = options?.format || 'text';
      const encoding = options?.encoding || 'utf-8';

      if (format === 'json' && typeof data === 'object') {
        fileData = JSON.stringify(data, null, 2);
      } else if (format === 'binary' && Buffer.isBuffer(data)) {
        fileData = data;
      } else {
        fileData = String(data);
      }

      await fsPromises.writeFile(
        fullPath,
        fileData,
        format === 'binary'
          ? undefined
          : { encoding: encoding as BufferEncoding },
      );

      this.logger.log(`File saved: ${fullPath}`);
      return fullPath;
    } catch (error) {
      this.logger.error(`Failed to save file: ${filepath}`, error);
      throw new Error(`Failed to save file: ${filepath}`);
    }
  }

  /**
   * Read file as string or buffer
   */
  async readFile(
    filepath: string,
    options?: { encoding?: string; format?: 'json' | 'text' | 'binary' },
  ): Promise<string | Buffer | object> {
    try {
      const fullPath = path.resolve(this.baseDir, filepath);
      const format = options?.format || 'text';
      const encoding = options?.encoding || 'utf-8';

      if (format === 'binary') {
        const data = await fsPromises.readFile(fullPath);
        return data;
      }

      const data = await fsPromises.readFile(fullPath, {
        encoding: encoding as BufferEncoding,
      });

      if (format === 'json') {
        return JSON.parse(data);
      }

      return data;
    } catch (error) {
      this.logger.error(`Failed to read file: ${filepath}`, error);
      throw new Error(`Failed to read file: ${filepath}`);
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filepath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.baseDir, filepath);
      await fsPromises.access(fullPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(filepath: string): Promise<boolean> {
    try {
      const fullPath = path.resolve(this.baseDir, filepath);
      await fsPromises.unlink(fullPath);
      this.logger.log(`File deleted: ${fullPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete file: ${filepath}`, error);
      return false;
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(dirpath: string): Promise<string[]> {
    try {
      const fullPath = path.resolve(this.baseDir, dirpath);
      const files = await fsPromises.readdir(fullPath);
      return files;
    } catch (error) {
      this.logger.error(`Failed to list files in directory: ${dirpath}`, error);
      throw new Error(`Failed to list files in directory: ${dirpath}`);
    }
  }
}
