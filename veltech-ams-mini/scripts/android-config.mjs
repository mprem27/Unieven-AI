import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isIP, BlockList} from 'node:net';
import {lookup} from 'node:dns/promises';

export const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const androidRoot = path.join(repositoryRoot, 'android');
export const defaultConfigFile = path.join(androidRoot, 'config.local.json');
export const projectDirectory = path.join(androidRoot, 'generated');
export const BUBBLEWRAP_VERSION = '1.27.0';
export const GRADLE_VERSION = '8.11.1';
export const BUILD_TOOLS_VERSION = '36.1.0';
// Official https://services.gradle.org/distributions/gradle-8.11.1-bin.zip.sha256
export const GRADLE_SHA256 = 'f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6';

const configKeys = new Set(['deploymentUrl', 'packageId', 'appName', 'launcherName',
  'versionName', 'versionCode', 'signingKeyFile', 'signingKeyAlias']);
const reserved = new Set(('abstract assert boolean break byte case catch char class const continue '
  + 'default do double else enum extends final finally float for goto if implements import instanceof '
  + 'int interface long native new package private protected public return short static strictfp '
  + 'super switch synchronized this throw throws transient try void volatile while true false null').split(' '));

export function validateConfig(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error('Config must be a JSON object.');
  for (const key of Object.keys(input)) if (!configKeys.has(key)) throw new Error(`Unknown Android config field: ${key}. Store no passwords in this file.`);
  let url;
  try { url = new URL(input.deploymentUrl); } catch { throw new Error('deploymentUrl must be a real public HTTPS origin.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || url.pathname !== '/' || url.search || url.hash || isIP(host.replace(/^\[|\]$/g, ''))
    || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host)
    || /(?:^|\.)(?:localhost|local|internal|test|invalid|example|onion)$/.test(host)
    || /(?:^|\.)example\.(?:com|net|org)$/.test(host)) {
    throw new Error('deploymentUrl must be a real public HTTPS origin, with no credentials, port, path, query, or fragment. Edit android/config.local.json line 2.');
  }
  if (typeof input.packageId !== 'string' || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,}$/.test(input.packageId)
    || input.packageId.split('.').some(part => reserved.has(part))) throw new Error('packageId must contain at least three valid Java package segments.');
  for (const key of ['appName', 'launcherName']) {
    if (typeof input[key] !== 'string' || !/^[\p{L}\p{N} ._()-]{1,50}$/u.test(input[key]) || !input[key].trim()) {
      throw new Error(`${key} must be 1-50 plain letters, numbers, spaces, dots, underscores, parentheses, or hyphens.`);
    }
  }
  if (!Number.isInteger(input.versionCode) || input.versionCode < 1 || input.versionCode > 2100000000) throw new Error('versionCode must be a positive Android version integer.');
  if (typeof input.versionName !== 'string' || !/^\d+\.\d+\.\d+(?:[-.][a-zA-Z0-9.]+)?$/.test(input.versionName)) throw new Error('versionName must be a version such as 1.8.0.');
  if (typeof input.signingKeyFile !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:keystore|jks)$/.test(input.signingKeyFile)) throw new Error('signingKeyFile must be a keystore filename inside android/private.');
  if (typeof input.signingKeyAlias !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,49}$/.test(input.signingKeyAlias)) throw new Error('signingKeyAlias must be a plain key alias.');
  return {...input, deploymentUrl: url.origin};
}

export async function readConfig(configFile = defaultConfigFile) {
  try { return validateConfig(JSON.parse(await readFile(configFile, 'utf8'))); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error('Copy android/config.example.json to android/config.local.json, then replace deploymentUrl on line 2 with your deployed HTTPS origin.');
    throw error;
  }
}

const nonPublic = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24],
  ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]]) nonPublic.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16]]) nonPublic.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 4) return !nonPublic.check(address, 'ipv4');
  if (family === 6) return /^[23][0-9a-f]{3}:/i.test(address) && !nonPublic.check(address, 'ipv6');
  return false;
}

export async function assertPublicDomain(config, resolver = lookup) {
  const answers = await resolver(new URL(config.deploymentUrl).hostname, {all: true, verbatim: true});
  if (!answers.length) throw new Error('DNS returned no addresses for deploymentUrl.');
  if (answers.some(answer => !isPublicAddress(answer.address))) throw new Error('The deployment domain must resolve only to public Internet addresses.');
}

export function createTwaManifest(config, signingKeyPath) {
  return {
    packageId: config.packageId, host: new URL(config.deploymentUrl).host,
    name: config.appName, launcherName: config.launcherName,
    display: 'standalone', displayOverride: [], startUrl: `/?androidPackage=${encodeURIComponent(config.packageId)}&androidVersionCode=${config.versionCode}#/home`,
    themeColor: '#101C35', themeColorDark: '#101C35', navigationColor: '#101C35',
    navigationColorDark: '#101C35', navigationDividerColor: '#101C35',
    navigationDividerColorDark: '#101C35', backgroundColor: '#F5F7FB',
    iconUrl: `${config.deploymentUrl}/icons/app-512.png`,
    maskableIconUrl: `${config.deploymentUrl}/icons/app-512.png`,
    webManifestUrl: `${config.deploymentUrl}/manifest.webmanifest`,
    fullScopeUrl: `${config.deploymentUrl}/`,
    appVersion: config.versionName, appVersionCode: config.versionCode,
    signingKey: {path: signingKeyPath, alias: config.signingKeyAlias},
    splashScreenFadeOutDuration: 300, enableNotifications: true,
    fallbackType: 'customtabs', enableSiteSettingsShortcut: true,
    minSdkVersion: 24, orientation: 'default', shortcuts: [],
    features: {}, alphaDependencies: {enabled: false},
    additionalTrustedOrigins: [], fingerprints: [],
    generatorApp: `velstudents-bubblewrap-${BUBBLEWRAP_VERSION}`,
  };
}

export function createAssetLinks(config, fingerprint) {
  if (typeof fingerprint !== 'string' || !/^(?:[a-fA-F0-9]{2}:){31}[a-fA-F0-9]{2}$/.test(fingerprint)) throw new Error('Supply the full colon-separated SHA-256 certificate fingerprint from keytool.');
  return [{relation: ['delegate_permission/common.handle_all_urls'], target: {
    namespace: 'android_app', package_name: config.packageId,
    sha256_cert_fingerprints: [fingerprint.toUpperCase()],
  }}];
}

export function createAssetLinksNginx(template) {
  const marker = '    location ^~ /api/v1/ { return 404; }';
  if (template.split(marker).length !== 2) throw new Error('The production Nginx template changed. Add the exact public Asset Links route to your HTTPS proxy before building.');
  return template.replace(marker, `    # Android verified domain association: public certificate metadata only.\n    location = /.well-known/assetlinks.json {\n        alias /etc/nginx/dal/assetlinks.json;\n        default_type application/json;\n        add_header X-Content-Type-Options nosniff always;\n        add_header Strict-Transport-Security "max-age=31536000" always;\n    }\n${marker}`);
}

export function configDigest(config) {
  return createHash('sha256').update(JSON.stringify(Object.fromEntries([...configKeys].map(key => [key, config[key]])))).digest('hex');
}

export function argumentsFor(argv, allowed) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!Object.hasOwn(allowed, key)) throw new Error(`Unknown argument ${key}.`);
    if (allowed[key] === 'flag') options[key] = true;
    else {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value for ${key}.`);
      options[key] = argv[++i];
    }
  }
  return options;
}
