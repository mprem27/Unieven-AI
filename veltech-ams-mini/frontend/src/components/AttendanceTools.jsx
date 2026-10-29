import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {ArrowUpRight,Calculator,ChevronLeft,ChevronRight,Download,FileSpreadsheet,RotateCcw,X} from 'lucide-react';
import {Badge,Button,EmptyState,Field} from './UI';
import {displayDate} from '../lib/attendance';
import {downloadFile} from '../lib/download';
import {createAttendancePress} from '../lib/attendance-press';
import {attendanceCalendar,attendancePeriod,attendancePlan,filterAttendanceRecords,recordMark,markLabel,shiftAttendanceMonth,validAttendanceDate,createAttendanceReport} from '../lib/attendance-tools';

export function AttendanceExports({subjects,records,mode,target=75,today,scope='All attendance',compact=false}) {
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const save=async format=>{
  setBusy(true);setError('');
  try{
   const {attendanceXlsx,attendancePdf}=await import('../lib/attendance-tools');
   const report=createAttendanceReport({subjects,records,mode,target,today,scope});
   const content=format==='xlsx'?attendanceXlsx(report):attendancePdf(report);
   downloadFile(`unieve-${mode==='demo'?'fictional-demo':'attendance'}-${today || 'export'}.${format}`,content,format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf');
  }catch{setError('The attendance file could not be created. Please try again.');}finally{setBusy(false);}
 };
 return <div className={`att-exports ${compact?'compact':''}`}><Button variant="secondary" disabled={busy || (!subjects.length && !records.length)} onClick={()=>save('pdf')}><Download size={15}/>{compact?'PDF':'Export PDF'}</Button><Button variant="secondary" disabled={busy || (!subjects.length && !records.length)} onClick={()=>save('xlsx')}><FileSpreadsheet size={15}/>{compact?'Excel':'Export Excel'}</Button>{error?<span role="alert" className="att-export-error">{error}</span>:null}</div>;
}

export function TargetSlider({target,onChange,label='Target attendance'}) {
 const id=useId();
 return <div className="att-target-control"><div><label htmlFor={id}>{label}</label><output htmlFor={id}>{target}%</output></div><input id={id} type="range" min="0" max="100" step="1" value={target} onChange={event=>onChange(Number(event.target.value))}/><div className="att-range-labels"><span>0%</span><span>75% usual minimum</span><span>100%</span></div></div>;
}

export function AttendancePlanResult({present,total,target,source=false}) {
 const plan=attendancePlan(present,total,target);
 if(!plan.valid && source)return <p className="att-plan-message">Data not available</p>;
 if(!plan.valid)return <p role="status" className="att-plan-message">Enter whole, nonnegative class counts, attended no greater than total, and a target from 0% to 100%.</p>;
 let title,description;
 if(target===0){title='No minimum at 0%';description='A 0% target places no limit on future absences.';}
 else if(!plan.total){title='No classes recorded yet';description='Attend the first class to establish attendance at or above your target.';}
 else if(plan.needed===Infinity){title='100% cannot be reached after a missed class';description='Attending future classes approaches 100% but cannot erase a past missed or unmarked class.';}
 else if(plan.needed>0){title=`Attend the next ${plan.needed} ${plan.needed===1?'class':'classes'}`;description=`Attend every one to reach at least ${target}%. You can miss 0 classes at this target right now.`;}
 else{title=`You can miss ${plan.canMiss} ${plan.canMiss===1?'class':'classes'}`;description=`Your attendance stays at or above ${target}% after ${plan.canMiss===1?'that absence':'those absences'}. ${plan.canMiss===0?'Attend your next class to protect your target.':'This assumes no other changes to your record.'}`;}
 return <div className={`att-plan-result ${plan.needed>0?'needs-attention':''}`} role="status"><strong>{title}</strong><p>{description}</p></div>;
}

export function AttendanceCalculator({initialTarget=75}) {
 const [present,setPresent]=useState(''),[total,setTotal]=useState(''),[target,setTarget]=useState(initialTarget);
 return <details className="panel att-calculator" id="attendance-calculator"><summary><Calculator size={19}/><span>Calculate with your own numbers<small>Try a target or plan your next classes.</small></span><span className="att-details-arrow">+</span></summary><div className="att-calculator-body"><p className="muted">1. Enter classes attended and total classes held. 2. Set your target. 3. Read how many classes to attend or how many you can miss.</p><div className="att-number-fields"><Field label="Classes attended"><input type="number" min="0" step="1" inputMode="numeric" value={present} onChange={event=>setPresent(event.target.value)} placeholder="e.g. 23"/></Field><Field label="Total classes held"><input type="number" min="0" step="1" inputMode="numeric" value={total} onChange={event=>setTotal(event.target.value)} placeholder="e.g. 25"/></Field></div><TargetSlider target={target} onChange={setTarget}/><AttendancePlanResult present={present} total={total} target={target}/><details className="att-formulas"><summary>How the calculation works</summary><p>Attendance = attended ÷ total × 100.</p><p>With target as a fraction t (75% = 0.75):</p><p>Classes to attend = round up [(t × total − attended) ÷ (1 − t)], with a minimum of 0.</p><p>Classes you can miss = round down [(attended ÷ t) − total], with a minimum of 0.</p><p>The formulas assume each upcoming class counts once, attended classes add 1 to both counts, and missed classes add 1 to total only. At 0%, there is no minimum. At 100%, any past missed class makes the target unreachable in a finite number of future classes. For no recorded classes, attend the first class to establish a percentage.</p></details><p className="att-help-note">These are planning estimates. Unmarked classes in the source total stay in the denominator. On duty receives credit only if the source summary already includes it. Your entries do not change academic records.</p></div></details>;
}

const calendarMarks=['present','absent','on-duty','unknown','upcoming'];

function AttendanceCalendar({month,onMonth,records,today,selected,onSelect}) {
 const calendar=useMemo(()=>attendanceCalendar(month,records,today),[month,records,today]);
 const [activeDate,setActiveDate]=useState(''),calendarRef=useRef(null),summaryRef=useRef(null),triggerRef=useRef(null),summaryId=useId(),press=useMemo(()=>createAttendancePress(),[]);
 const activeDay=calendar?.days.find(day=>day.date===activeDate);
 const monthTitle=calendar?displayDate(`${month}-01`,{day:undefined,month:'long'}):'Choose a month';
 const closeSummary=(restoreFocus=false)=>{setActiveDate('');if(restoreFocus)triggerRef.current?.focus({preventScroll:true});};
 const openDay=(day,trigger)=>{triggerRef.current=trigger;setActiveDate(day.date);};
 const changeMonth=value=>{press.cancel();closeSummary();onMonth(value);};
 useEffect(()=>{
  const move=event=>press.move(event),up=event=>press.end(event),cancel=()=>press.cancel();
  window.addEventListener('pointermove',move,{passive:true});window.addEventListener('pointerup',up);
  window.addEventListener('pointercancel',cancel);window.addEventListener('scroll',cancel,{capture:true,passive:true});window.addEventListener('blur',cancel);
  return()=>{press.dispose();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('scroll',cancel,true);window.removeEventListener('blur',cancel);};
 },[press]);
 useEffect(()=>{
  if(!activeDate)return;
  const summary=summaryRef.current,anchor=triggerRef.current?.getBoundingClientRect(),calendarBox=calendarRef.current?.getBoundingClientRect();
  if(summary && anchor && calendarBox){
   const phoneNav=document.querySelector('.phone-bottom-nav')?.getBoundingClientRect();
   const viewportBottom=Math.min(window.visualViewport?.height || window.innerHeight,phoneNav?.height?phoneNav.top:window.innerHeight);
   summary.style.maxHeight=`${Math.min(480,viewportBottom-24)}px`;
   const top=Math.max(12,Math.min(anchor.bottom+8,viewportBottom-summary.getBoundingClientRect().height-12));
   summary.style.top=`${top-calendarBox.top}px`;
   summary.focus({preventScroll:true});
  }
  const outside=event=>{if(!summaryRef.current?.contains(event.target) && !event.target.closest?.('.att-calendar-day'))closeSummary();};
  const escape=event=>{if(event.key==='Escape'){event.preventDefault();closeSummary(true);}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[activeDate]);
 return <section ref={calendarRef} className="att-calendar" aria-label="Attendance calendar">
  <div className="att-calendar-heading"><div className="att-calendar-title"><h3>{monthTitle}</h3><span>Source periods</span></div><div><button type="button" className="icon-button" aria-label="Previous attendance month" disabled={!shiftAttendanceMonth(month,-1)} onClick={()=>changeMonth(shiftAttendanceMonth(month,-1))}><ChevronLeft size={18}/></button><label className="att-month-label"><span className="att-sr-only">Attendance month</span><input type="month" min="1000-01" max="9999-12" value={month} onChange={event=>{if(event.target.value)changeMonth(event.target.value);}}/></label><button type="button" className="icon-button" aria-label="Next attendance month" disabled={!shiftAttendanceMonth(month,1)} onClick={()=>changeMonth(shiftAttendanceMonth(month,1))}><ChevronRight size={18}/></button></div></div>
  <div className="att-calendar-grid" role="group" aria-label="Attendance dates">
   {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day=><span key={day} className="att-weekday">{day}</span>)}
   {calendar?Array.from({length:calendar.leading},(_,index)=><span className="att-calendar-spacer" key={`before-${index}`} aria-hidden="true"/>):null}
   {calendar?.days.map(day=>{
    const summary=calendarMarks.filter(mark=>day.counts[mark]).map(mark=>`${day.counts[mark]} ${markLabel(mark).toLowerCase()}`).join(', ');
    return <button type="button" key={day.date} className={`att-calendar-day ${day.records.length?'has-records':''} ${selected===day.date || activeDate===day.date?'selected':''} ${today===day.date?'today':''}`} aria-current={today===day.date?'date':undefined} aria-pressed={selected===day.date} aria-haspopup="dialog" aria-expanded={activeDate===day.date} aria-controls={activeDate===day.date?summaryId:undefined} aria-label={`${displayDate(day.date)}: ${summary || 'Data not available'}`} onPointerDown={event=>{const trigger=event.currentTarget;press.start(event,()=>openDay(day,trigger));}} onContextMenu={event=>event.preventDefault()} onClick={event=>{if(!press.consumeClick(event))openDay(day,event.currentTarget);}}>
     <span className="att-day-number">{day.day}</span><span className="att-day-total" aria-hidden="true">{day.records.length || '—'}{day.records.length?<small>{day.records.length===1?'period':'periods'}</small>:null}</span>
     {day.records.length?<span className="att-day-strip" aria-hidden="true">{calendarMarks.filter(mark=>day.counts[mark]).map(mark=><span key={mark} className={mark} style={{flexGrow:day.counts[mark]}}/>)}</span>:null}
    </button>;
   })}
   {calendar?Array.from({length:calendar.trailing},(_,index)=><span className="att-calendar-spacer" key={`after-${index}`} aria-hidden="true"/>):null}
  </div>
  <div className="att-calendar-legend">{calendarMarks.map(mark=><span key={mark}><i className={`att-legend-dot ${mark}`}/>{markLabel(mark)}</span>)}</div>
  <p className="att-help-note">Select or hold a date for details. Blank dates have no supplied records.</p>
  {activeDay?<div ref={summaryRef} id={summaryId} className="att-day-summary" role="dialog" aria-modal="false" aria-labelledby={`${summaryId}-title`} tabIndex={-1} onBlur={event=>{if(event.relatedTarget && !event.currentTarget.contains(event.relatedTarget))closeSummary();}}>
   <div className="att-day-summary-heading"><div><h4 id={`${summaryId}-title`}>{displayDate(activeDay.date,{weekday:'long'})}</h4><p>{activeDay.records.length?`${activeDay.records.length} source ${activeDay.records.length===1?'period':'periods'}`:'Data not available'}</p></div><button type="button" className="icon-button" aria-label="Close date summary" onClick={()=>closeSummary(true)}><X size={18}/></button></div>
   <dl className="att-day-counts">{calendarMarks.filter(mark=>mark!=='upcoming' || activeDay.counts.upcoming>0).map(mark=><div key={mark} className={mark}><dt>{mark==='on-duty'?'OD':markLabel(mark)}</dt><dd>{activeDay.records.length?activeDay.counts[mark]:'—'}</dd></div>)}</dl>
   {activeDay.records.length?<ul className="att-day-records">{activeDay.records.map((record,index)=><li key={`${record.id || ''}:${index}`}><span className="att-day-period">{attendancePeriod(record)}</span><span className="att-day-subject">{record.subjectName || record.subjectCode || 'Data not available'}{record.subjectName && record.subjectCode?<small>{record.subjectCode}</small>:null}</span><span className={`att-mark ${recordMark(record,today)}`}>{markLabel(recordMark(record,today))}</span></li>)}</ul>:<p className="att-day-empty">No attendance marks were supplied for this date.</p>}
   <Button variant="secondary" onClick={()=>{onSelect(activeDay.date);closeSummary(true);}}>View date records <ArrowUpRight size={14}/></Button>
  </div>:null}
 </section>;
}

export function AttendanceHistory({records,subjects,mode,today,target=75,subjectName=''}) {
 const [month,setMonth]=useState(()=>validAttendanceDate(today)?today.slice(0,7):new Date().toISOString().slice(0,7)),[date,setDate]=useState(''),[status,setStatus]=useState('all'),[query,setQuery]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[page,setPage]=useState(1);
 const enriched=useMemo(()=>{
  const byId=new Map(subjects.filter(subject=>subject.id!=null).map(subject=>[String(subject.id),subject])),byCode=new Map(subjects.filter(subject=>subject.code).map(subject=>[subject.code,subject]));
  return records.map(record=>{
  const subject=(record.subjectId!=null?byId.get(String(record.subjectId)):null) || byCode.get(record.subjectCode);
  return {...record,subjectCode:record.subjectCode || subject?.code || '',subjectName:record.subjectName || subject?.name || 'Data not available'};
 });},[records,subjects]);
 const matching=useMemo(()=>filterAttendanceRecords(enriched,{status,query,from,to},today),[enriched,status,query,from,to,today]);
 const filtered=useMemo(()=>filterAttendanceRecords(matching,{date},today),[matching,date,today]);
 const pages=Math.max(1,Math.ceil(filtered.length/30)),currentPage=Math.min(page,pages),visible=filtered.slice((currentPage-1)*30,currentPage*30);
 const change=(setter,value)=>{setter(value);setPage(1);};
 const reset=()=>{setDate('');setStatus('all');setQuery('');setFrom('');setTo('');setPage(1);};
 const scope=[subjectName || 'All subjects',date?`Date ${date}`:from || to?`${from || 'start'} to ${to || 'latest'}`:'All supplied dates',`Status: ${status}`,query?`Search: ${query}`:''].filter(Boolean).join(' | ');
 return <section className="panel att-history"><div className="att-section-heading"><div><h2>{subjectName?'Attendance history':'Calendar overview'}</h2><p className="muted">Browse the source marks by date and period.</p></div><Button variant="ghost" onClick={reset}><RotateCcw size={14}/>Reset filters</Button></div><div className="att-history-filters">{!subjectName?<Field label="Find subject"><input type="search" value={query} placeholder="Name or course code" onChange={event=>change(setQuery,event.target.value)}/></Field>:null}<Field label="Attendance status"><select value={status} onChange={event=>change(setStatus,event.target.value)}><option value="all">All marks</option>{['present','absent','on-duty','unknown','upcoming'].map(mark=><option key={mark} value={mark}>{markLabel(mark)}</option>)}</select></Field><Field label="From date"><input type="date" value={from} onChange={event=>{change(setFrom,event.target.value);setDate('');}}/></Field><Field label="To date"><input type="date" value={to} onChange={event=>{change(setTo,event.target.value);setDate('');}}/></Field></div>{from && to && from>to?<p className="att-filter-error" role="alert">From date must be on or before To date.</p>:null}<div className="att-history-layout"><AttendanceCalendar month={month} onMonth={value=>{setMonth(value);setDate('');setPage(1);}} records={enriched} today={today} selected={date} onSelect={value=>{reset();setDate(value);}}/><div className="att-records"><div className="att-record-heading"><div><h3>{date?displayDate(date):'All matching records'}</h3><p className="muted">{filtered.length} {filtered.length===1?'record':'records'}{date?<button type="button" className="text-button" onClick={()=>change(setDate,'')}>Show all dates</button>:null}</p></div><AttendanceExports subjects={subjects} records={filtered} mode={mode} target={target} today={today} scope={scope} compact/></div><p className="att-export-scope">Export: source summary + {filtered.length} matching records.</p>{visible.length?<><div className="table-scroll"><table className="att-record-table"><thead><tr><th>Date</th>{!subjectName?<th>Subject</th>:null}<th>Period</th><th>Mark</th></tr></thead><tbody>{visible.map((record,index)=><tr key={`${record.id || ''}:${record.date}:${record.period || ''}:${index}`}><td>{validAttendanceDate(record.date)?displayDate(record.date,{year:undefined}):'Data not available'}</td>{!subjectName?<td><strong>{record.subjectName}</strong><small>{record.subjectCode}</small></td>:null}<td>{attendancePeriod(record)}</td><td><Badge status={recordMark(record,today)}>{markLabel(recordMark(record,today))}</Badge></td></tr>)}</tbody></table></div>{pages>1?<div className="att-pagination"><Button variant="secondary" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}>Previous</Button><span>Page {currentPage} of {pages}</span><Button variant="secondary" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Next</Button></div>:null}</>:<EmptyState title={records.length?'No matching records':'Data not available'} description={records.length?'Try another date or reset your filters.':'The source may supply summary totals before daily attendance. Summary and daily record counts can differ.'}/>}</div></div></section>;
}
