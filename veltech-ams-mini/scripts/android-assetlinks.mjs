import {mkdir, writeFile, readFile} from 'node:fs/promises';
import path from 'node:path';
import {readConfig, createAssetLinks, createAssetLinksNginx, repositoryRoot, androidRoot, argumentsFor} from './android-config.mjs';

try {
  const options = argumentsFor(process.argv.slice(2), {'--config': 'value', '--fingerprint': 'value', '--help': 'flag'});
  if (options['--help']) {
    console.log('Usage: node scripts/android-assetlinks.mjs --fingerprint "AA:BB:..." [--config path]\nWrites android/out/assetlinks.json for your public HTTPS /.well-known/assetlinks.json endpoint.');
  } else {
    const config = await readConfig(options['--config']);
    const links = createAssetLinks(config, options['--fingerprint']);
    const output = path.join(androidRoot, 'out/assetlinks.json');
    await mkdir(path.dirname(output), {recursive: true});
    await writeFile(output, JSON.stringify(links, null, 2) + '\n');
    const template = createAssetLinksNginx(await readFile(path.join(repositoryRoot, 'docker/nginx.conf.template'), 'utf8'));
    await writeFile(path.join(androidRoot, 'out/nginx.conf.template'), template);
    console.log(`Created ${output}\nDeploy its contents at ${config.deploymentUrl}/.well-known/assetlinks.json with HTTP 200, application/json, no redirect, and no login.`);
  }
} catch (error) { console.error(`Asset Links generation stopped: ${error.message}`); process.exitCode = 1; }
