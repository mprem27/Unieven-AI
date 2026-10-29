import {fail} from '../security.js';

function text(value,label,max,{required=false}={}){
 if(value==null)value='';
 if(typeof value!=='string' || value.length>max || /[\x00-\x1f\x7f]/.test(value) || /^[=+@-]/.test(value.trim()))fail(400,`Enter a valid ${label} without formulas or control characters.`);
 const clean=value.trim();if(required && !clean)fail(400,`Enter a ${label}.`);return clean;
}
export function validateSeatingRooms(rooms){
 if(!Array.isArray(rooms) || !rooms.length || rooms.length>100)fail(400,'Configure between 1 and 100 rooms.');
 const seen=new Set();let capacity=0;
 const normalized=rooms.map(value=>{
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(key=>!['hall','room','capacity','seatPrefix'].includes(key)))fail(400,'Use hall, room, capacity and optional seat prefix for each room.');
  const hall=text(value.hall,'hall',120),room=text(value.room,'room',120,{required:true}),seatPrefix=text(value.seatPrefix,'seat prefix',50);
  if(!Number.isInteger(value.capacity) || value.capacity<1 || value.capacity>1000)fail(400,'Each room capacity must be an integer between 1 and 1,000.');
  const identity=JSON.stringify([hall.toUpperCase(),room.toUpperCase()]);if(seen.has(identity))fail(400,'Each hall and room must occur only once.');seen.add(identity);
  capacity+=value.capacity;return {hall,room,capacity:value.capacity,seatPrefix};
 });
 if(capacity>5000)fail(400,'The total room capacity cannot exceed 5,000 seats.');
 return {rooms:normalized,capacity};
}
export function allocateSeating(students,roomInput,{reportingTime=''}={}){
 const {rooms,capacity}=validateSeatingRooms(roomInput);
 if(!Array.isArray(students) || !students.length || students.length>5000)fail(400,'Upload an explicit roster of between 1 and 5,000 students.');
 const reporting=text(reportingTime,'reporting time',80),seen=new Set();
 const roster=students.map(student=>{
  if(!student || typeof student!=='object' || Array.isArray(student) || Object.keys(student).some(key=>!['vtuNumber','name'].includes(key)))fail(400,'The roster parser returned an invalid student.');
  const number=text(student.vtuNumber,'VTU number',20).toUpperCase();if(!/^VTU[0-9]{3,12}$/.test(number))fail(400,'Every roster student needs an exact VTU number.');
  if(seen.has(number))fail(400,'Duplicate VTU number: each student must occur only once.');seen.add(number);return number;
 }).sort();
 if(capacity<roster.length)fail(400,`Room capacity is ${capacity}; add seats for all ${roster.length} roster students before generating.`);
 let index=0;const rows=[];
 for(const room of rooms){for(let seat=1;seat<=room.capacity && index<roster.length;seat++)rows.push({vtuNumber:roster[index++],hall:room.hall,room:room.room,seat:room.seatPrefix+seat,reportingTime:reporting,notes:''});}
 return {rows,capacity,unusedSeats:capacity-rows.length};
}
