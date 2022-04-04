import { Uploader } from '../src';
import * as path from 'path';

test('change params', async () => {
  const uploadDir = path.join(__dirname, 'download');
  const uploader = new Uploader({ uploadDir: __dirname });
  uploader.changeParams({ uploadDir: uploadDir });
});
