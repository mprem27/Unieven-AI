import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateConfig, GRADLE_SHA256} from '../../scripts/android-config.mjs';
import {generateProject, deploymentResources, WRAPPER_SHA256} from '../../scripts/android-prepare.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const config = validateConfig({deploymentUrl: 'https://campus.velstudents.in',
  packageId: 'in.velstudents.veltechams', appName: 'Veltech AMS mini', launcherName: 'Veltech mini',
  versionName: '1.8.0', versionCode: 18, signingKeyFile: 'velstudents-release.keystore', signingKeyAlias: 'velstudents'});

async function fixtures() {
  return new Map([
    [`${config.deploymentUrl}/`, {body: Buffer.from('<!doctype html><title>Veltech</title>'), contentType: 'text/html'}],
    [`${config.deploymentUrl}/manifest.webmanifest`, {body: Buffer.from(JSON.stringify({
      name: config.appName, start_url: '/#/home', scope: '/', display: 'standalone',
      icons: [{src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable'}],
    })), contentType: 'application/manifest+json'}],
    [`${config.deploymentUrl}/icons/app-512.png`, {
      body: await readFile(path.join(root, 'frontend/public/icons/app-512.png')), contentType: 'image/png'}],
    [`${config.deploymentUrl}/sw.js`, {body: Buffer.from('self.addEventListener("fetch", () => {});'), contentType: 'application/javascript'}],
  ]);
}

test('generator creates a complete hardened Android project from real app icons without an SDK', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'velstudents-android-generator-'));
  try {
    await generateProject(config, temporary, await fixtures());
    const xml = await readFile(path.join(temporary, 'app/src/main/AndroidManifest.xml'), 'utf8');
    assert.match(xml, /android:usesCleartextTraffic="false"/);
    assert.match(xml, /android:allowBackup="false"/);
    assert.match(xml, /android:autoVerify="true"/);
    assert.doesNotMatch(xml, /<manifest[^>]*\bpackage=/);
    assert.match(xml, /android\.permission\.POST_NOTIFICATIONS/);
    assert.doesNotMatch(xml, /WebViewFallbackActivity|android\.permission\.CAMERA/);
    const gradle = await readFile(path.join(temporary, 'app/build.gradle'), 'utf8');
    assert.match(gradle, /com\.google\.androidbrowserhelper:androidbrowserhelper:2\.7\.4/);
    assert.match(gradle, /buildToolsVersion "36\.1\.0"/);
    assert.match(gradle, /versionCode 18/);
    assert.match(await readFile(path.join(temporary, 'build.gradle'), 'utf8'), /mavenCentral\(\)/);
    const wrapper = await readFile(path.join(temporary, 'gradle/wrapper/gradle-wrapper.jar'));
    assert.equal(createHash('sha256').update(wrapper).digest('hex'), WRAPPER_SHA256);
    assert.match(await readFile(path.join(temporary, 'gradle/wrapper/gradle-wrapper.properties'), 'utf8'),
      new RegExp(`distributionSha256Sum=${GRADLE_SHA256}`));
    const manifest = JSON.parse(await readFile(path.join(temporary, 'twa-manifest.json'), 'utf8'));
    assert.equal(manifest.startUrl, '/?androidPackage=in.velstudents.veltechams&androidVersionCode=18#/home');
    assert.equal(manifest.fallbackType, 'customtabs');
    assert.ok((await readFile(path.join(temporary, 'app/src/main/java/in/velstudents/veltechams/LauncherActivity.java'))).length > 100);
    assert.ok((await readFile(path.join(temporary, 'app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'))).length > 100);
    assert.ok((await readFile(path.join(temporary, 'gradlew.bat'))).length > 100);
  } finally { await rm(temporary, {recursive: true, force: true}); }
});

test('deployment checks reject wrong launch routes and HTML service worker fallbacks', async () => {
  const resources = await fixtures();
  const fetcher = async (url, options) => {
    assert.equal(options.redirect, 'error');
    const resource = resources.get(url);
    return new Response(resource.body, {headers: {'content-type': resource.contentType}});
  };
  assert.equal((await deploymentResources(config, fetcher)).size, 4);
  const workerUrl = `${config.deploymentUrl}/sw.js`;
  const worker = resources.get(workerUrl);
  resources.set(workerUrl, {body: Buffer.from('<!doctype html>fallback'), contentType: 'text/html'});
  await assert.rejects(deploymentResources(config, fetcher), /service worker/);
  resources.set(workerUrl, worker);
  resources.set(`${config.deploymentUrl}/manifest.webmanifest`, {
    body: Buffer.from(JSON.stringify({start_url: 'https://other.velstudents.in', scope: '/'})), contentType: 'application/json',
  });
  await assert.rejects(deploymentResources(config, fetcher), /start at/);
});

test('both CLI dry runs work with a configured origin and neither creates an APK', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'velstudents-android-cli-'));
  try {
    const configFile = path.join(temporary, 'config.json');
    await writeFile(configFile, JSON.stringify(config));
    for (const script of ['android-prepare.mjs', 'android-build.mjs']) {
      const result = spawnSync(process.execPath, [path.join(root, 'scripts', script), '--config', configFile, '--dry-run'], {encoding: 'utf8'});
      assert.equal(result.status, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).deploymentUrl, config.deploymentUrl);
      assert.match(JSON.parse(result.stdout).note, /No network/);
    }
    const rejected = spawnSync(process.execPath, [path.join(root, 'scripts/android-prepare.mjs'), '--config',
      path.join(root, 'android/config.example.json'), '--dry-run'], {encoding: 'utf8'});
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /real public HTTPS/);
  } finally { await rm(temporary, {recursive: true, force: true}); }
});

test('an explicit local release icon replaces an older deployed icon without changing the app origin',async()=>{
 const resources=await fixtures();const old=resources.get(`${config.deploymentUrl}/icons/app-512.png`);resources.set(`${config.deploymentUrl}/icons/app-512.png`,{body:Buffer.from('old invalid icon'),contentType:'image/png'});
 const fetcher=async url=>new Response(resources.get(url).body,{headers:{'content-type':resources.get(url).contentType}});
 const checked=await deploymentResources(config,fetcher,{iconFile:path.join(root,'frontend/public/icons/app-512.png')});
 assert.deepEqual(checked.get(`${config.deploymentUrl}/icons/app-512.png`).body,old.body);
});
