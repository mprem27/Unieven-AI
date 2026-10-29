import {readFile, writeFile, mkdir, rm, rename, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {
  androidRoot, projectDirectory, readConfig, createTwaManifest, argumentsFor,
  assertPublicDomain, configDigest, BUBBLEWRAP_VERSION, GRADLE_SHA256,
} from './android-config.mjs';

export const WRAPPER_SHA256 = '2db75c40782f5e8ba1fc278a5574bab070adccb2d21ca5a6e5ed840888448046';
const requireAndroid = createRequire(path.join(androidRoot, 'package.json'));

export async function deploymentResources(config, fetcher = fetch, {iconFile} = {}) {
  const resources = new Map();
  for (const resource of ['/', '/manifest.webmanifest', '/icons/app-512.png', '/sw.js']) {
    const url = `${config.deploymentUrl}${resource}`;
    const response = await fetcher(url, {redirect: 'error', signal: AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}. Deploy the working web app first.`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > 8 * 1024 * 1024) throw new Error(`Resource is too large: ${url}`);
    resources.set(url, {body, contentType: response.headers.get('content-type') || ''});
  }
  if (!resources.get(`${config.deploymentUrl}/`).contentType.includes('text/html')) throw new Error('The deployed root must serve the web app as HTML.');
  const manifest = JSON.parse(resources.get(`${config.deploymentUrl}/manifest.webmanifest`).body.toString());
  const start = new URL(manifest.start_url, `${config.deploymentUrl}/manifest.webmanifest`);
  if (start.href !== `${config.deploymentUrl}/#/home`) throw new Error('The deployed PWA manifest must start at /#/home on the configured origin.');
  if (new URL(manifest.scope || '.', config.deploymentUrl).href !== `${config.deploymentUrl}/`) throw new Error('Deploy the PWA at the domain root with scope /.');
  if (iconFile) resources.set(`${config.deploymentUrl}/icons/app-512.png`, {body: await readFile(iconFile), contentType: 'image/png'});
  const icon = resources.get(`${config.deploymentUrl}/icons/app-512.png`);
  if (!icon.contentType.startsWith('image/png') || icon.body.length < 24
    || icon.body.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    || icon.body.readUInt32BE(16) < 512 || icon.body.readUInt32BE(20) < 512) throw new Error('The deployed /icons/app-512.png must be a PNG of at least 512 × 512 pixels.');
  const worker = resources.get(`${config.deploymentUrl}/sw.js`);
  if (!/(?:javascript|ecmascript)/i.test(worker.contentType) || worker.body.length < 20) throw new Error('The deployed /sw.js must be the built PWA service worker, not an HTML fallback.');
  return resources;
}

export async function generateProject(config, target, resources) {
  const {TwaGenerator, TwaManifest, ConsoleLog, fetchUtils} = requireAndroid('@bubblewrap/core');
  if (requireAndroid('@bubblewrap/core/package.json').version !== BUBBLEWRAP_VERSION) throw new Error('Run npm --prefix android ci to install the pinned generator.');
  const wrapper = await readFile(path.join(androidRoot, 'gradle/gradle-wrapper.jar'));
  if (createHash('sha256').update(wrapper).digest('hex') !== WRAPPER_SHA256) throw new Error('Gradle wrapper checksum mismatch. Restore the official wrapper before building.');
  await mkdir(target, {recursive: true});
  const signingKeyPath = path.join(process.env.CAMPUS_ANDROID_KEY_DIRECTORY || path.join(androidRoot, 'private'), config.signingKeyFile);
  const manifest = new TwaManifest(createTwaManifest(config, signingKeyPath));
  // Supply the exact resources already checked above; the generator cannot follow
  // a second, unchecked redirect or fetch a different origin while creating icons.
  const originalFetch = fetchUtils.fetch;
  fetchUtils.fetch = async url => {
    const resource = resources.get(String(url));
    if (!resource) throw new Error(`Generator requested an unchecked resource: ${url}`);
    return new Response(resource.body, {status: 200, headers: {'content-type': resource.contentType}});
  };
  try { await new TwaGenerator().createTwaProject(target, manifest, new ConsoleLog('Velstudents Android')); }
  finally { fetchUtils.fetch = originalFetch; }
  await manifest.saveToFile(path.join(target, 'twa-manifest.json'));
  const gradleFile = path.join(target, 'build.gradle');
  await writeFile(gradleFile, (await readFile(gradleFile, 'utf8')).replaceAll('jcenter()', 'mavenCentral()'));
  const appGradleFile = path.join(target, 'app/build.gradle');
  await writeFile(appGradleFile, (await readFile(appGradleFile, 'utf8')).replace('compileSdkVersion 36', 'compileSdkVersion 36\n    buildToolsVersion "36.1.0"'));
  const manifestFile = path.join(target, 'app/src/main/AndroidManifest.xml');
  let xml = await readFile(manifestFile, 'utf8');
  // AGP 8 uses app/build.gradle's namespace; keep no legacy package attribute.
  xml = xml.replace(/<!-- The "package" attribute[\s\S]*?-->/, '<!-- Namespace and applicationId are set in app/build.gradle. -->');
  xml = xml.replace(/(<manifest\b[^>]*?)\s+package="[^"]*"/, '$1');
  xml = xml.replace('android:allowBackup="true"', 'android:allowBackup="false"\n        android:usesCleartextTraffic="false"');
  xml = xml.replace(/\s*<activity android:name="com\.google\.androidbrowserhelper\.trusted\.WebViewFallbackActivity"[\s\S]*?\/>/, '');
  await writeFile(manifestFile, xml);
  await copyFile(path.join(androidRoot, 'gradle/gradle-wrapper.jar'), path.join(target, 'gradle/wrapper/gradle-wrapper.jar'));
  const wrapperProperties = path.join(target, 'gradle/wrapper/gradle-wrapper.properties');
  await writeFile(wrapperProperties, `${(await readFile(wrapperProperties, 'utf8')).trim()}\ndistributionSha256Sum=${GRADLE_SHA256}\n`);
  await writeFile(path.join(target, 'velstudents-build.json'), JSON.stringify({
    configDigest: configDigest(config), bubblewrapVersion: BUBBLEWRAP_VERSION,
    wrapperSha256: WRAPPER_SHA256, deploymentUrl: config.deploymentUrl,
  }, null, 2) + '\n');
}

export async function main(argv = process.argv.slice(2)) {
  const options = argumentsFor(argv, {'--config': 'value', '--local-icon': 'value', '--dry-run': 'flag', '--help': 'flag'});
  if (options['--help']) {
    console.log('Usage: node scripts/android-prepare.mjs [--config path] [--dry-run]\nDry run validates local configuration only. Normal preparation checks the live HTTPS PWA and generates android/generated.');
    return;
  }
  const config = await readConfig(options['--config']);
  if (options['--dry-run']) {
    console.log(JSON.stringify({status: 'configuration-valid', deploymentUrl: config.deploymentUrl,
      launchUrl: `${config.deploymentUrl}${createTwaManifest(config,'').startUrl}`, output: projectDirectory,
      packageId: config.packageId, note: 'No network, Android project, key, or APK created.'}, null, 2));
    return;
  }
  await assertPublicDomain(config);
  const resources = await deploymentResources(config, fetch, {iconFile: options['--local-icon']});
  const staging = path.join(androidRoot, `.generated-${process.pid}`);
  try {
    await generateProject(config, staging, resources);
    await rm(projectDirectory, {recursive: true, force: true});
    await rename(staging, projectDirectory);
  } finally { await rm(staging, {recursive: true, force: true}); }
  console.log(`Generated ${projectDirectory}. Next build with your private release key and deploy Digital Asset Links as described in docs/ANDROID.md.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Android preparation stopped: ${error.message}`); process.exitCode = 1; });
}
