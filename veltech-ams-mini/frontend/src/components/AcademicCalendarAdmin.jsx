import ScopeSelect from './ScopeSelect';
import {sameDepartment} from '../../../shared/publishing-directory.mjs';
import {hasAdminPermission} from '../../../shared/admin-access.mjs';
import {useCallback,useEffect,useRef,useState} from 'react';
import {CalendarDays,Plus,RefreshCw,Save,Trash2,Pencil} from 'lucide-react';
import {useCampus} from '../context/CampusContext';
import {request} from '../lib/api';
import {calendarDateRange,resolveAcademicDay,WEEK_DAYS} from '../lib/academic-calendar';
import {Button,PageHeader,Field,Feedback,EmptyState,Badge} from './UI';
import './academic-calendar-admin.css';

const newClass=()=>({courseCode:'',courseName:'',startTime:'',endTime:'',room:'',faculty:''});
const newDraft=(date,college,department)=>({date,mode:'holiday',label:'',reason:'',scope:college?'college':'department',department:college?'':department,studentIds:[],followDay:'Monday',classes:[newClass()]});
const describeScope=entry=>entry.scope==='college'?'Whole college':entry.scope==='department'?entry.department:`${entry.studentIds?.length || entry.targetCount || 0} selected student${(entry.studentIds?.length || entry.targetCount)===1?'':'s'}`;
const payloadFor=draft=>({date:draft.date,mode:draft.mode,label:draft.label.trim(),reason:draft.reason.trim(),scope:draft.scope,department:draft.scope==='department'?draft.department:'',studentIds:draft.scope==='students'?draft.studentIds:[],followDay:draft.mode==='follow-day'?draft.followDay:'',classes:draft.mode==='special'?draft.classes:[]});

export default function AcademicCalendarAdmin(){
 const {mode,data,today,updateDemo,refresh}=useCampus(),profile=data.profile || {};
 const demo=mode==='demo',college=demo || hasAdminPermission(profile,'calendar');
 const assignedDepartment=(demo?profile.department:profile.campusDepartment ?? profile.department) || '';
 const allowed=demo || college || (profile.campusRole==='department_coordinator' && !!assignedDepartment.trim());
 const owner=`${mode}:${profile.id}:${profile.campusRole}:${assignedDepartment}`,ownerRef=useRef(owner);ownerRef.current=owner;
 const [range,setRange]=useState(()=>calendarDateRange(today)),[entries,setEntries]=useState([]),[directory,setDirectory]=useState([]),[departments,setDepartments]=useState([]);
 const [draft,setDraft]=useState(()=>newDraft(today,college,assignedDepartment)),[editing,setEditing]=useState(''),[query,setQuery]=useState(''),[studentDepartment,setStudentDepartment]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[removing,setRemoving]=useState('');
 const requestSequence=useRef(0);
 useEffect(()=>{setEntries([]);setDirectory([]);setDepartments([]);setDraft(newDraft(today,college,assignedDepartment));setEditing('');setQuery('');setStudentDepartment('');setRemoving('');setError('');setMessage('');setBusy(false);setLoading(false);},[owner]);
 const load=useCallback(async()=>{
  if(!allowed || demo)return;
  const key=owner,sequence=++requestSequence.current;setLoading(true);setError('');
  try{const result=await request(`/academic-calendar/manage?${new URLSearchParams(range)}`);if(ownerRef.current!==key || sequence!==requestSequence.current)return;setEntries(result.entries || []);setDirectory(result.students || []);setDepartments(result.departments || []);}
  catch(e){if(ownerRef.current===key && sequence===requestSequence.current)setError(e.message);}
  finally{if(ownerRef.current===key && sequence===requestSequence.current)setLoading(false);}
 },[allowed,demo,owner,range.from,range.to]);
 useEffect(()=>{load();return()=>{requestSequence.current++;};},[load]);
 useEffect(()=>{if(!demo)return;setEntries((data.calendarPolicies || []).filter(entry=>entry.date>=range.from && entry.date<=range.to));setDirectory([{id:profile.id,name:profile.name || 'Sample student',studentId:profile.studentId || '',department:profile.department || ''}]);setDepartments(profile.department?[profile.department]:[]);},[demo,data.calendarPolicies,profile.id,profile.name,profile.studentId,profile.department,range.from,range.to]);
 const set=(key,value)=>setDraft(current=>({...current,[key]:value}));
 function reset(){setDraft(newDraft(today,college,assignedDepartment));setEditing('');setRemoving('');setError('');setMessage('');}
 function edit(entry){setDraft({...entry,reason:entry.reason || '',studentIds:entry.studentIds || [],followDay:entry.followDay || 'Monday',classes:entry.classes?.length?entry.classes.map(row=>({...row})):[newClass()]});setEditing(entry.id);setRemoving('');setError('');setMessage('');document.getElementById('academic-calendar-editor')?.scrollIntoView({behavior:'smooth',block:'start'});}
 function selectStudent(id){setDraft(current=>({...current,studentIds:current.studentIds.includes(id)?current.studentIds.filter(value=>value!==id):[...current.studentIds,id]}));}
 async function save(e){
  e.preventDefault();const key=owner;setBusy(true);setError('');setMessage('');
  try{
   const body=payloadFor(draft);resolveAcademicDay({date:body.date});
   if(!body.label)throw new Error('Enter a calendar label.');
   if(body.scope==='department' && !body.department)throw new Error('Choose an assigned academic department.');
   if(body.scope==='students' && (!body.studentIds.length || body.studentIds.length>100))throw new Error('Choose 1–100 students from the authorized directory.');
   if(body.mode==='special'){
    const sorted=body.classes.toSorted((a,b)=>a.startTime.localeCompare(b.startTime));
    if(sorted.some((row,index)=>!row.courseCode.trim() || !row.courseName.trim() || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.startTime) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(row.endTime) || row.endTime<=row.startTime || (index>0 && sorted[index-1].endTime>row.startTime)))throw new Error('Enter every course and its times. Special class periods must not overlap.');
   }
   if(demo){
    const all=data.calendarPolicies || [];
    const competing=all.find(entry=>entry.id!==editing && entry.date===body.date && entry.scope===body.scope && (body.scope==='college' || (body.scope==='department' && entry.department===body.department) || (body.scope==='students' && entry.studentIds?.some(id=>body.studentIds.includes(id)))));
    if(competing)throw new Error('An entry already covers this date and scope. Edit it instead.');
    const now=new Date().toISOString(),entry={...body,id:editing || crypto.randomUUID(),source:'administrator',updatedAt:now,createdAt:now,fictional:true};
    updateDemo(current=>({...current,calendarPolicies:[...(current.calendarPolicies || []).filter(row=>row.id!==editing),entry]}));
   }else{
    await request(editing?`/academic-calendar/${editing}`:'/academic-calendar',{method:editing?'PATCH':'POST',body});
    if(ownerRef.current!==key)return;
    await Promise.all([load(),refresh()]);
   }
   if(ownerRef.current!==key)return;
   setDraft(newDraft(body.date,college,assignedDepartment));setEditing('');setMessage(demo?'Fictional calendar saved for this preview.':'Calendar entry saved. Affected students will see it when their calendar refreshes.');
  }catch(e){if(ownerRef.current===key)setError(e.message);}
  finally{if(ownerRef.current===key)setBusy(false);}
 }
 async function remove(entry){
  const key=owner;setBusy(true);setError('');setMessage('');
  try{if(demo)updateDemo(current=>({...current,calendarPolicies:(current.calendarPolicies || []).filter(row=>row.id!==entry.id)}));else{await request(`/academic-calendar/${entry.id}`,{method:'DELETE'});if(ownerRef.current!==key)return;await Promise.all([load(),refresh()]);}if(ownerRef.current!==key)return;setRemoving('');if(editing===entry.id){setEditing('');setDraft(newDraft(today,college,assignedDepartment));}setMessage(demo?'Fictional calendar entry removed.':'Calendar entry removed. The next applicable calendar or source timetable now applies.');}
  catch(e){if(ownerRef.current===key)setError(e.message);}
  finally{if(ownerRef.current===key)setBusy(false);}
 }
 if(!allowed)return <><PageHeader title="Academic calendar" description="Publish holidays, substitute weekdays and selected-student classes."/><EmptyState title="Academic calendar staff access required" description="An administrator or a coordinator with an assigned academic department can manage calendar changes."/></>;
 const filtered=directory.filter(student=>(!studentDepartment || sameDepartment(student.department,studentDepartment)) && `${student.name} ${student.studentId} ${student.department}`.toLowerCase().includes(query.toLowerCase()));
 let preview=null;try{preview=resolveAcademicDay({date:draft.date,classes:data.timetable || data.classes || [],policies:[{...payloadFor(draft),id:editing || 'draft'}]});}catch{}
 return <div className="academic-calendar-admin"><PageHeader title="Academic calendar" description="Set the timetable students should follow on a specific date."><Button variant="secondary" busy={loading} onClick={load} disabled={demo}><RefreshCw size={16}/>Refresh</Button></PageHeader>
  {demo?<div className="calendar-admin-note"><strong>Fictional administrator preview</strong><span>Try calendar changes for the sample student. These changes stay in this browser’s demo.</span></div>:<div className="calendar-admin-note"><strong>{college?'College administrator':'Department coordinator'}</strong><span>{college?'Publish college dates, department changes or classes for selected students.':`Your assigned department: ${assignedDepartment}.`}</span></div>}
  <p className="muted calendar-admin-guidance">Selected-student changes take priority over department changes, then college changes. Each entry replaces that date’s regular timetable for its audience. Attendance stays attached to the actual date.</p>
  <Feedback error={error} success={message}/>
  <div className="calendar-admin-layout"><section id="academic-calendar-editor" className="panel calendar-admin-editor"><div className="section-title"><h2><CalendarDays size={19}/>{editing?'Edit calendar entry':'Add calendar entry'}</h2>{editing?<Button variant="secondary" onClick={reset} disabled={busy}>Cancel edit</Button>:null}</div>
   <form onSubmit={save}><fieldset disabled={busy} className="calendar-admin-fieldset"><div className="calendar-admin-form-grid">
    <Field label="Date"><input type="date" required value={draft.date} onChange={e=>set('date',e.target.value)}/></Field>
    <Field label="Day arrangement"><select value={draft.mode} onChange={e=>setDraft(current=>({...current,mode:e.target.value,...(e.target.value==='special'?{scope:'students',department:'',studentIds:demo?[profile.id]:current.studentIds}:{})}))}><option value="holiday">Holiday · no regular classes</option><option value="follow-day">Follow another weekday</option><option value="special">Special classes · selected students</option></select></Field>
    <Field label="Calendar label"><input required maxLength={160} value={draft.label} placeholder="e.g. Monday timetable on Saturday" onChange={e=>set('label',e.target.value)}/></Field>
    <Field label="Audience"><select value={draft.scope} disabled={draft.mode==='special'} onChange={e=>setDraft(current=>({...current,scope:e.target.value,department:e.target.value==='department'?(assignedDepartment || departments[0] || ''):'',studentIds:[]}))}>{college?<option value="college">Whole college</option>:null}<option value="department">Assigned department</option><option value="students">Selected students</option></select></Field>
    {draft.scope==='department'?<ScopeSelect kind="department" label="Academic department" required value={draft.department} disabled={!college} onChange={value=>set('department',value)}/>:null}
    {draft.mode==='follow-day'?<Field label="Use source timetable for"><select value={draft.followDay} onChange={e=>set('followDay',e.target.value)}>{[...WEEK_DAYS.slice(1),WEEK_DAYS[0]].map(day=><option key={day}>{day}</option>)}</select></Field>:null}
   </div>
   <Field label="Reason or instructions (optional)"><textarea rows={3} maxLength={1000} value={draft.reason} onChange={e=>set('reason',e.target.value)} placeholder="Instructions visible to affected students"/></Field>
   {draft.scope==='students'?<section className="calendar-admin-targets"><h3>Choose students <span>{draft.studentIds.length}/100 selected</span></h3><p className="muted">Select from your authorized campus directory. To target a section, choose its verified student accounts individually.</p><div className="calendar-admin-form-grid"><Field label="Find a student"><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name or student ID"/></Field>{college && departments.length>1?<Field label="Filter student department"><select value={studentDepartment} onChange={e=>setStudentDepartment(e.target.value)}><option value="">All assigned departments</option>{departments.map(value=><option key={value}>{value}</option>)}</select></Field>:null}</div><div className="calendar-admin-student-list">{filtered.slice(0,100).map(student=><label key={student.id}><input type="checkbox" checked={draft.studentIds.includes(student.id)} disabled={!draft.studentIds.includes(student.id) && draft.studentIds.length>=100} onChange={()=>selectStudent(student.id)}/><span><strong>{student.name}</strong><small>{student.studentId || 'Campus student account'} · {student.department || 'Department unassigned'}</small></span></label>)}{!filtered.length?<p className="muted">No authorized students match this search.</p>:null}</div>{filtered.length>100?<small className="muted">Showing 100 results. Narrow your search to find another student.</small>:null}{draft.studentIds.length?<div className="calendar-admin-selected">{draft.studentIds.map(id=><button key={id} type="button" onClick={()=>selectStudent(id)} aria-label={`Remove ${directory.find(s=>s.id===id)?.name || 'selected student'}`}><span>{directory.find(s=>s.id===id)?.name || 'Selected campus account'}</span>×</button>)}</div>:null}</section>:null}
   {draft.mode==='special'?<section className="calendar-admin-custom"><div className="section-title"><h3>Special class periods</h3><Button variant="secondary" type="button" disabled={draft.classes.length>=16} onClick={()=>set('classes',[...draft.classes,newClass()])}><Plus size={15}/>Add period</Button></div><p className="muted">Use explicit times in India Standard Time. These periods replace the selected students’ regular timetable for this date.</p>{draft.classes.map((row,index)=><fieldset key={index} className="calendar-admin-period"><legend>Period {index+1}</legend><div className="calendar-admin-form-grid">{[['courseCode','Course code','text',40],['courseName','Course name','text',180],['startTime','Start time (IST)','time',5],['endTime','End time (IST)','time',5],['room','Room (optional)','text',120],['faculty','Faculty (optional)','text',160]].map(([key,label,type,max])=><Field key={key} label={label}><input type={type} required={!['room','faculty'].includes(key)} value={row[key]} maxLength={max} onChange={e=>set('classes',draft.classes.map((value,i)=>i===index?{...value,[key]:e.target.value}:value))}/></Field>)}</div><Button type="button" variant="secondary" disabled={draft.classes.length===1} onClick={()=>set('classes',draft.classes.filter((_,i)=>i!==index))}><Trash2 size={14}/>Remove period {index+1}</Button></fieldset>)}</section>:null}
   {preview?<div className="calendar-admin-preview"><strong>Preview · {preview.weekday}, {draft.date}</strong><span>{preview.label || 'Add a calendar label'} · Administrator calendar</span>{preview.kind==='holiday'?<small>No regular classes on this date for the selected audience.</small>:preview.kind==='special'?<small>{draft.classes.length} custom period{draft.classes.length===1?'':'s'} for selected students.</small>:<small>{preview.sourceDay} source timetable. Each student uses their own source classes; a missing source day stays empty.</small>}</div>:null}
   <Button type="submit" busy={busy}><Save size={16}/>{editing?'Save changes':demo?'Save fictional calendar':'Publish calendar entry'}</Button></fieldset></form></section>
   <section className="panel calendar-admin-entries"><div className="section-title"><h2>Published dates</h2><Badge>{entries.length}</Badge></div><div className="calendar-admin-form-grid"><Field label="Show from"><input type="date" value={range.from} onChange={e=>setRange(current=>({...current,from:e.target.value}))}/></Field><Field label="Show until"><input type="date" value={range.to} onChange={e=>setRange(current=>({...current,to:e.target.value}))}/></Field></div>
    {loading?<p className="muted" role="status">Loading calendar…</p>:entries.length?<div className="calendar-admin-entry-list">{entries.map(entry=><article key={entry.id}><div className="calendar-admin-entry-title"><strong>{entry.label}</strong><Badge>{entry.mode==='holiday'?'Holiday':entry.mode==='follow-day'?entry.followDay:'Special classes'}</Badge></div><time dateTime={entry.date}>{entry.date}</time><p>{describeScope(entry)}</p>{entry.reason?<p className="muted">{entry.reason}</p>:null}<small className="muted">{demo?'Fictional preview':'Administrator calendar'}{entry.mode==='special'?` · ${entry.classes.length} period${entry.classes.length===1?'':'s'} (IST)`:''}</small>{removing===entry.id?<div className="calendar-admin-remove"><p>Remove this entry? The next applicable calendar or source timetable will apply.</p><div className="toolbar"><Button variant="secondary" disabled={busy} onClick={()=>setRemoving('')}>Keep entry</Button><Button variant="danger" busy={busy} onClick={()=>remove(entry)}>Remove entry</Button></div></div>:<div className="toolbar"><Button variant="secondary" disabled={busy} onClick={()=>edit(entry)}><Pencil size={14}/>Edit</Button><Button variant="secondary" disabled={busy} onClick={()=>setRemoving(entry.id)}><Trash2 size={14}/>Remove</Button></div>}</article>)}</div>:<EmptyState title="No calendar changes in this range" description="Students follow their source timetable unless an applicable calendar entry changes the day."/>}
   </section></div></div>;
}
