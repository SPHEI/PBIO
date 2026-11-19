const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const certDirectory = path.resolve(__dirname, '../certs');
const certificate = path.join(certDirectory, 'localhost.pem');
const privateKey = path.join(certDirectory, 'localhost-key.pem');

if (fs.existsSync(certificate) && fs.existsSync(privateKey)) {
  process.exit(0);
}

fs.mkdirSync(certDirectory, { recursive: true });
const result = spawnSync('mkcert', [
  '-cert-file', certificate,
  '-key-file', privateKey,
  'localhost', '127.0.0.1', '::1',
], { stdio: 'inherit' });

if (result.error || result.status !== 0) {
  console.error('Could not create local HTTPS certificates. Install mkcert and run "mkcert -install", then retry.');
  process.exit(result.status || 1);
}
