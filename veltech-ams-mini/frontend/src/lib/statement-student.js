import {officialStudentProfile} from './social-profile.js';
const scalar=value=>typeof value==='string'||typeof value==='number'?String(value).trim():'';
export function statementStudent(profile={},mode='connected'){
 const source=officialStudentProfile(profile,mode),value={};
 for(const key of ['name','degree','department'])if(scalar(source[key]))value[key]=scalar(source[key]);
 const roll=scalar(source.rollNumber),vtu=scalar(source.vtuNumber || source.portalUsername || source.amsUsername);
 const registration=scalar(source.registrationNumber || source.registerNumber || source.registrationNo) || (roll && !/^vtu/i.test(roll)?roll:'');
 if(registration)value.registrationNumber=registration;
 if(vtu)value.rollNumber=vtu;else if(roll && (registration!==roll || /^vtu/i.test(roll)))value.rollNumber=roll;
 return value;
}
