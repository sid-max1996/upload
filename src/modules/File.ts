import * as fs from 'fs';

export default class File {
  static stats(path: string): Promise<fs.Stats | null> {
    return new Promise((resolve, reject) => {
      fs.stat(path, (err, stat) => {
        if (err == null) {
          resolve(stat);
        } else if (err.code === 'ENOENT') {
          resolve(null);
        } else {
          reject(err);
        }
      });
    });
  }

  static remove(path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.unlink(path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}