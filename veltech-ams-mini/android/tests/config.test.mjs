import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  validateConfig, createTwaManifest, createAssetLinks, assertPublicDomain,
  isPublicAddress, configDigest, createAssetLinksNginx,
} from '../../scripts/android-config.mjs';

const good = {
  deploymentUrl: 'https://campus.velstudents.in',
  packageId: 'in.velstudents.veltechams', appName: 'Veltech AMS mini',
  launcherName: 'Veltech mini', versionName: '1.8.0', versionCode: 18,
  signingKeyFile: 'velstudents-release.keystore', signingKeyAlias: 'velstudents',
};

test('the delivered example intentionally cannot produce a release', async () => {
  const example = JSON.parse(await readFile(new URL('../config.example.json', import.meta.url)));
  assert.throws(() => validateConfig(example), /real public HTTPS/);
});

test('release config accepts a public HTTPS origin and preserves the hash router launch', () => {
  const config = validateConfig(good);
  const manifest = createTwaManifest(config, '/private/release.keystore');
  assert.equal(manifest.host, 'campus.velstudents.in');
  assert.equal(manifest.startUrl, '/?androidPackage=in.velstudents.veltechams&androidVersionCode=18#/home');
  assert.equal(manifest.webManifestUrl, 'https://campus.velstudents.in/manifest.webmanifest');
  assert.equal(manifest.iconUrl, 'https://campus.velstudents.in/icons/app-512.png');
  assert.equal(manifest.maskableIconUrl, manifest.iconUrl);
  assert.equal(manifest.fallbackType, 'customtabs');
  assert.equal(manifest.enableNotifications, true);
  assert.deepEqual(manifest.additionalTrustedOrigins, []);
  assert.equal(manifest.minSdkVersion, 24);
  assert.equal(manifest.signingKey.path, '/private/release.keystore');
  assert.equal(JSON.stringify(manifest).includes('password'), false);
});

test('release config rejects unsafe, placeholder, credentialed, and subpath URLs', () => {
  for (const deploymentUrl of [
    'http://campus.velstudents.in', 'https://example.invalid', 'https://example.com',
    'https://localhost', 'https://127.0.0.1', 'https://10.1.1.2', 'https://[::1]',
    'https://campus.local', 'https://campus.internal', 'https://campus.test',
    'https://user:pass@campus.velstudents.in', 'https://campus.velstudents.in:8443',
    'https://campus.velstudents.in/student', 'https://campus.velstudents.in?secret=1',
    'https://campus.velstudents.in/#/home',
  ]) assert.throws(() => validateConfig({...good, deploymentUrl}), undefined, deploymentUrl);
});

test('release metadata cannot escape key storage or inject generated source', () => {
  for (const patch of [
    {packageId: 'in.velstudents."attack'}, {packageId: 'in.class.app'},
    {appName: '<activity/>'}, {appName: 'name\nnext'}, {launcherName: ''},
    {signingKeyFile: '../secrets.keystore'}, {signingKeyFile: 'key.txt'},
    {signingKeyAlias: '--help'}, {versionCode: 0}, {versionCode: 1.5},
    {versionName: '1"evil'}, {password: 'must-not-be-stored'},
  ]) assert.throws(() => validateConfig({...good, ...patch}), undefined, JSON.stringify(patch));
});

test('DNS validation refuses private and mixed public/private answers', async () => {
  const config = validateConfig(good);
  await assertPublicDomain(config, async () => [{address: '93.184.216.34'}]);
  await assert.rejects(assertPublicDomain(config, async () => []), /DNS/);
  await assert.rejects(assertPublicDomain(config, async () => [{address: '10.0.0.5'}]), /public/);
  await assert.rejects(assertPublicDomain(config, async () => [
    {address: '93.184.216.34'}, {address: 'fd00::1'},
  ]), /public/);
  for (const address of ['127.0.0.1', '169.254.1.1', '100.64.0.1', '192.0.2.8',
    '198.51.100.2', '203.0.113.8', '::1', '::ffff:10.0.0.1', 'fe80::1',
    '2001:db8::1', '2002::1']) assert.equal(isPublicAddress(address), false, address);
  assert.equal(isPublicAddress('2606:4700:4700::1111'), true);
});

test('asset links contain only the configured package and a valid signing certificate', () => {
  const fingerprint = Array(32).fill('AB').join(':');
  const links = createAssetLinks(validateConfig(good), fingerprint.toLowerCase());
  assert.deepEqual(links, [{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {namespace: 'android_app', package_name: good.packageId,
      sha256_cert_fingerprints: [fingerprint]},
  }]);
  assert.throws(() => createAssetLinks(validateConfig(good), 'AB:CD'), /SHA-256/);
});

test('config digest changes when the origin, signing identity, or release version changes', () => {
  const config = validateConfig(good);
  assert.equal(configDigest(config), configDigest({...config}));
  for (const patch of [{deploymentUrl: 'https://ams.velstudents.in'}, {versionCode: 19},
    {signingKeyAlias: 'other'}]) assert.notEqual(configDigest(config), configDigest({...config, ...patch}));
});

test('production proxy overlay serves only the exact public Asset Links endpoint', async () => {
  const original = await readFile(new URL('../../docker/nginx.conf.template', import.meta.url), 'utf8');
  const generated = createAssetLinksNginx(original);
  assert.match(generated, /location = \/\.well-known\/assetlinks\.json/);
  assert.match(generated, /alias \/etc\/nginx\/dal\/assetlinks\.json/);
  assert.match(generated, /default_type application\/json/);
  assert.ok(generated.includes('location ^~ /api/v1/ { return 404; }'));
  assert.ok(generated.includes('ssl_certificate /etc/nginx/tls/fullchain.pem;'));
  assert.throws(() => createAssetLinksNginx('server {}'), /template changed/);
});
