// Runs only when the MongoDB data directory is empty. Password changes after
// initialization require db.updateUser(), not an env-file edit alone.
for(const [database,user,password] of [
  ['unieve_campus_v1',process.env.MONGO_CAMPUS_USER,process.env.MONGO_CAMPUS_PASSWORD],
  ['unieve_campus_attendance_v1',process.env.MONGO_ACADEMIC_USER,process.env.MONGO_ACADEMIC_PASSWORD],
]) {
  if(!user || !password || password.length<32)throw new Error('Configure distinct application database users and strong passwords.');
  db.getSiblingDB(database).createUser({user,pwd:password,roles:[{role:'readWrite',db:database}]});
}
