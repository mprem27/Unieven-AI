const sections=new Set(['overview','courses','results','marks','credits','examinations','fees','documents','rules']);
const aliases={'course-registration':'courses',assessment:'marks',assessments:'marks'};
export function academicSection(value){const id=aliases[value] || value;return sections.has(id)?id:'overview';}
export function academicHref(value='overview'){const id=academicSection(value);return id==='overview'?'/academics':`/academics?section=${id}`;}

export const studentMenu=[
 {label:'Study',items:[['academics','Academics','Marks, results and course records'],['attendance','Attendance','Subject totals, calendar and calculator'],['timetable','Timetable','Today and your full week'],['schedules','Published schedules','Semester and college schedules']]},
 {label:'Campus',items:[['events','Events','Discover events and your tickets'],['community','Community','Posts, reels and campus conversations'],['connections','Connections','Classmates and collaborators'],['placements','Placements','Campus and off-campus opportunities'],['forms','Feedback & forms','Forms published by your faculty']]},
 {label:'Account',items:[['profile','Student details','Your university record'],['notifications','Notifications','Your campus inbox'],['settings','Settings','App, account and download preferences']]},
];
