"""Export one self-contained source project and its built PWA, never private state."""
import argparse, hashlib, json, re, zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
EXCLUDED={'.git','.private','node_modules','dist','__pycache__','.venv','.pytest_cache','uploads','artifacts','downloads','logs','target','.campus-media','.onboarding','.npm-cache','.cache','.gradle','generated','private','out','build','.campus-releases','app-releases','migration-reports'}

def allowed(path):
 relative=path.relative_to(ROOT)
 return not path.is_symlink() and not any(part in EXCLUDED or part.startswith('.generated-') for part in relative.parts) and path.name not in {'.progress.md','.env'} and not path.name.startswith('.env.') and path.suffix not in {'.log','.pyc','.zip','.jks','.keystore','.p12','.apk','.aab'} and path.name not in {'config.local.json','local.properties','keystore.properties'}

def export(destination):
 destination.mkdir(parents=True,exist_ok=True)
 source=destination/'veltech-ams-mini-source.zip'
 with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
  for path in sorted(ROOT.rglob('*')):
   if path.is_file() and (allowed(path) or path in {ROOT/'.env.example',ROOT/'.env.production.example',ROOT/'.env.tunnel.example'}):
    archive.write(path,'veltech-ams-mini/'+path.relative_to(ROOT).as_posix())
 dist=ROOT/'frontend/dist'
 if not (dist/'index.html').is_file():raise RuntimeError('Build frontend first: npm run build')
 mobile=destination/'veltech-ams-mini-web.zip'
 with zipfile.ZipFile(mobile,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
  for path in sorted(dist.rglob('*')):
   if path.is_file():archive.write(path,'veltech-ams-mini-mobile-web/'+path.relative_to(dist).as_posix())
  archive.writestr('veltech-ams-mini-mobile-web/README.md','# veltech-ams-mini PWA\n\nBuilt static preview. Serve at an HTTPS origin for phone installation; connected accounts need the combined source backend under the same origin. This is not an APK. Private live access requires the combined backend and your own AMS session. See docs/VERIFICATION.md in the source ZIP for verified and unavailable sections.\n')
 guide=destination/'setup-guide.md';guide.write_bytes((ROOT/'README.md').read_bytes())
 # Archive-level guard: no private files, cache copies, symlink dependency trees,
 # machine secrets or the supplied student's identifier/password-shaped literal.
 for package in (source,mobile):
  with zipfile.ZipFile(package) as archive:
   for name in archive.namelist():
    if any(part in EXCLUDED-{'dist'} for part in Path(name).parts):raise RuntimeError('Excluded member in export')
    data=archive.read(name)
    if re.search(rb'vtu' + rb'263[0-9]{2}|' + rb'Lo' + rb'@[0-9]{8}',data,re.I):raise RuntimeError('Private account pattern in export')
 manifest={'version':'2.3.3','project':'veltech-ams-mini','files':[]}
 for path in (source,mobile,guide):
  manifest['files'].append({'name':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 target=destination/'manifest.json';target.write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps(manifest,indent=2))

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',type=Path,default=ROOT.parent/'artifacts');export(parser.parse_args().output)
