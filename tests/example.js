const { Uploader } = require('../dist');
const fs = require('fs');
const path = require('path');
const ProxyAgent = require('proxy-agent');

const url = 'https://klike.net/uploads/posts/2019-07/1564314090_3.jpg';
const uploadDir = path.join(__dirname, 'download');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const uploader = new Uploader({
  // byteLimit: 500, // bytes per second limit for download
  // proxyAgent: ProxyAgent('http://51.91.157.66:80'), // to use proxy
  uploadDir, // path to the folder where files are uploaded
  // continueUploading: true // continue downloading from where it stopped
});
uploader.emitter.on('debug', (text) => console.log(text));
uploader.emitter.on('log', (text) => console.log(text));
// tracking download progress
uploader.emitter.on('progress', (value) => console.log(`Progress (value: ${value}).`));

async function start() {
  const filePath = await uploader.upload({
    url,
    // uploadDir: __dirname, // change uploaded file dir
    // fileName: 'hello.jpg', // change uploaded file name
    // filePath: path.join(uploadDir, 'hello1.jpg'), // change uploaded file path
    // continueUploading: true // change continue downloading from where it stopped
    headers: { 'User-Agent': 'App' },
  });
  console.log(`Uploaded (path: ${filePath}).`);
  uploader.emitter.removeAllListeners(); // remove all event subscriptions
}

start();
