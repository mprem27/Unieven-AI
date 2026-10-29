"""Offline, non-destructive MongoDB -> PostgreSQL/FerretDB copy and verification.
Use the academic service's Python environment (pymongo and python-dotenv).
"""
import argparse, hashlib, json, os, sys
from pathlib import Path
from bson import json_util
from dotenv import dotenv_values
from pymongo import MongoClient

def digest(collection):
    h=hashlib.sha256();count=0
    for row in collection.find().sort('_id',1).batch_size(200):
        h.update(json_util.dumps(row,json_options=json_util.CANONICAL_JSON_OPTIONS,sort_keys=True,separators=(',',':')).encode());h.update(b'\n');count+=1
    return {'count':count,'sha256':h.hexdigest()}

def migrate(source_uri,target_uri,database,verify_only=False):
    if source_uri==target_uri: raise ValueError('Source and destination must be different servers.')
    source=MongoClient(source_uri,serverSelectionTimeoutMS=10000);target=MongoClient(target_uri,serverSelectionTimeoutMS=10000)
    try:
        source.admin.command('ping');target.admin.command('ping');src=source[database];dst=target[database]
        # Explicit names supplied by the operator; never copy all server databases.
        if database in ('admin','local','config','postgres') or not database:raise ValueError('Choose only an application database.')
        definitions=list(src.list_collections())
        if any(row.get('type')!='collection' for row in definitions):raise ValueError('Views need an explicit operator migration plan.')
        if not verify_only and any(dst[name].estimated_document_count() for name in dst.list_collection_names()):raise ValueError('Destination must be empty; existing records are never overwritten.')
        report={'database':database,'collections':[],'verified':True}
        for definition in sorted(definitions,key=lambda r:r['name']):
            name=definition['name']
            if name.startswith('system.'):continue
            before=digest(src[name])
            if not verify_only:
                for spec in src[name].list_indexes():
                    if spec['name']=='_id_':continue
                    options={k:spec[k] for k in ('name','unique','sparse','partialFilterExpression','expireAfterSeconds') if k in spec}
                    dst[name].create_index(list(spec['key'].items()),**options)
                batch=[]
                for row in src[name].find().batch_size(200):
                    batch.append(row)
                    if len(batch)==200:dst[name].insert_many(batch,ordered=True);batch=[]
                if batch:dst[name].insert_many(batch,ordered=True)
            after=digest(dst[name]);stable=digest(src[name]);ok=before==after==stable
            report['collections'].append({'name':name,'source':before,'destination':after,'verified':ok});report['verified'] &= ok
        extras=set(dst.list_collection_names())-{r['name'] for r in definitions}
        if any(dst[n].estimated_document_count() for n in extras):report['verified']=False
        return report
    finally:source.close();target.close()

def main():
    p=argparse.ArgumentParser();p.add_argument('--config',type=Path,required=True);p.add_argument('--verify-only',action='store_true');p.add_argument('--report',type=Path,required=True);args=p.parse_args()
    values=dotenv_values(args.config);reports=[]
    for prefix in ('CAMPUS','ACADEMIC'):
        keys=[f'SOURCE_{prefix}_URI',f'TARGET_{prefix}_URI',f'{prefix}_DATABASE'];missing=[k for k in keys if not values.get(k)]
        if missing:raise ValueError('Missing configuration keys: '+', '.join(missing))
        reports.append(migrate(*(values[k] for k in keys),verify_only=args.verify_only))
    result={'verified':all(r['verified'] for r in reports),'databases':reports}
    args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(result,indent=2)+'\n');os.chmod(args.report,0o600)
    print('Verified both application databases.' if result['verified'] else 'Verification failed. Keep the old database active and investigate the report.');return 0 if result['verified'] else 2
if __name__=='__main__':
    try:sys.exit(main())
    except Exception as error:
        print('Migration stopped safely ('+type(error).__name__+'). No source data was deleted. Check private configuration, empty destination, and database compatibility.',file=sys.stderr);sys.exit(1)
