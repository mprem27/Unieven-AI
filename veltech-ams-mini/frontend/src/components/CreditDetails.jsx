import {useState} from 'react';
import {ChevronDown,Download,FileText} from 'lucide-react';
import {downloadFile,csv} from '../lib/download';
import {creditColumns,creditColumnLabel,creditReportSections} from '../lib/academic-results';
import {Button,EmptyState} from './UI';
import '../academic-results.css';

const names={course:'Course ledger',category:'Category / bucket reports',semester:'Semester summaries',summary:'Other source summaries',other:'Other source records'};
function fieldsFor(rows){
 const available=Object.keys(creditColumns).filter(key=>rows.some(row=>row[key]!==undefined));
 const sourceOrder=rows.find(row=>row.sourceColumns)?.sourceColumns;
 return sourceOrder?[...new Set([...Object.keys(sourceOrder).filter(key=>available.includes(key)),...available])]:available;
}
function sectionTitle(group){return `${group.report || names[group.kind]}${group.semester?` · Semester ${group.semester}`:''}`;}
export default function CreditDetails({rows=[],summary=[]}){
 const [requestedKind,setKind]=useState('all'),groups=creditReportSections(rows),kinds=[...new Set(groups.map(group=>group.kind))],kind=kinds.includes(requestedKind)?requestedKind:'all',selected=kind==='all'?groups:groups.filter(group=>group.kind===kind);
 function save(){
  const output=[];
  for(const group of selected){const fields=fieldsFor(group.rows);output.push([sectionTitle(group)],['Record section',names[group.kind]],[...fields.map(field=>creditColumnLabel(field,group.rows))],...group.rows.map(row=>fields.map(field=>row[field])),[]);}
  if(summary.length)output.push(['Published AMS summary'],['Summary','Value','Source report','Source'],...summary.map(row=>[row.label,row.value,row.sourceReport,row.source]));
  downloadFile('ams-credit-earned-details.csv',csv(output),'text/csv');
 }
 return <div className="credit-details">
  {summary.length?<section className="credit-published-summary" aria-label="Published credit summary"><h3>Published summary</h3><div className="credits-summary">{summary.map((row,index)=><div key={index}><small>{row.label}</small><strong>{row.value}</strong>{row.sourceReport?<span>{row.sourceReport}</span>:null}</div>)}</div></section>:null}
  {kinds.length>1?<div className="academic-view-switch credit-view-switch" role="group" aria-label="Credit record category"><button type="button" aria-pressed={kind==='all'} onClick={()=>setKind('all')}>All credit reports<span>{rows.length}</span></button>{kinds.map(value=><button type="button" key={value} aria-pressed={kind===value} onClick={()=>setKind(value)}>{names[value]}<span>{groups.filter(group=>group.kind===value).reduce((count,group)=>count+group.rows.length,0)}</span></button>)}</div>:null}
  <div className="academic-record-heading"><div><h3>{kind==='all'?'Credit reports':names[kind]}</h3><p>{selected.reduce((count,group)=>count+group.rows.length,0)} source records · {selected.length} {selected.length===1?'report division':'report divisions'}</p></div><Button variant="secondary" disabled={!rows.length&&!summary.length} onClick={save}><Download size={15}/>Export credit details</Button></div>
  {selected.length?<><p className="academic-report-explanation">Course records, category requirements and semester summaries remain separate. Values and column headings follow the source; totals are not added together.</p><div className="academic-report-list">{selected.map((group,index)=>{const fields=fieldsFor(group.rows);return <details className="academic-report credit-report" key={group.key} open={index===0 || group.kind!=='course'}><summary><span className="academic-report-icon"><FileText size={17}/></span><span className="academic-report-title"><strong>{sectionTitle(group)}</strong><small>{names[group.kind]}</small></span><span className="academic-report-count">{group.rows.length} {group.rows.length===1?'record':'records'}</span><ChevronDown size={17} className="academic-report-chevron"/></summary><div className="table-scroll"><table className="academic-detail-table"><caption className="sr-only">{sectionTitle(group)} — {names[group.kind]}</caption><thead><tr>{fields.map(field=><th key={field}>{creditColumnLabel(field,group.rows)}</th>)}</tr></thead><tbody>{group.rows.map((row,index)=><tr key={index}>{fields.map(field=><td key={field}>{row[field]??'—'}</td>)}</tr>)}</tbody></table></div></details>;})}</div></>:!summary.length?<EmptyState title="Credit details are not available" description="Sync AMS to read the credit records published for your account."/>:<p className="academic-report-explanation">Only the published summary is available. No course credit ledger was supplied.</p>}
 </div>;
}
