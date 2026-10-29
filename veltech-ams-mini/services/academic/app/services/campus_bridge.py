"""Bind campus identity to one private academic workspace; never claim by email."""
import secrets
from bson import ObjectId
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError
from app.security.jwt import create_access_token
from app.security.password import hash_password
from app.utils.dates import utc_now

def reply(user, identity):
    if not user or user.get('role') != 'student' or not user.get('active'):
        raise HTTPException(403, 'An active student workspace is required.')
    if user.get('email') != identity['email'].strip().lower():
        raise HTTPException(409, 'The campus identity does not match this academic workspace.')
    return {'token': create_access_token(str(user['_id']), 'student'),
            'user': {'id': str(user['_id']), 'email': user['email'], 'name': user.get('name', '')}}

def campus_session(db, identity):
    campus_id = identity['campusId']; email = identity['email'].strip().lower()
    users = db['users']; existing = users.find_one({'campusUserId': campus_id})
    if existing: return reply(existing, identity)
    if users.find_one({'email': email}):
        raise HTTPException(409, 'An academic account already uses your email. Verify its password in Settings to migrate it.')
    now = utc_now()
    user = {'campusUserId': campus_id, 'email': email, 'name': identity['name'].strip(),
            'branch': identity.get('department', '').strip(), 'role': 'student', 'active': True,
            'passwordHash': hash_password(secrets.token_urlsafe(32)), 'mustChangePassword': False,
            'passwordChangedAt': now, 'source': 'campus-account', 'createdAt': now, 'updatedAt': now}
    # Do not insert null VTU fields: a sparse unique index still indexes null.
    try:
        user['_id'] = users.insert_one(user).inserted_id
    except DuplicateKeyError:
        user = users.find_one({'campusUserId': campus_id})
        if not user: raise HTTPException(409, 'An academic account already uses your email. Verify it before migration.')
    return reply(user, identity)

def bind_verified_account(db, identity):
    users = db['users']; academic_id = ObjectId(identity['academicId'])
    existing = users.find_one({'campusUserId': identity['campusId']})
    if existing and existing['_id'] != academic_id:
        raise HTTPException(409, 'This campus account already owns a different academic workspace.')
    user = users.find_one({'_id': academic_id, 'email': identity['email'].strip().lower(), 'active': True, 'role': 'student'})
    if not user or user.get('campusUserId') not in (None, identity['campusId']):
        raise HTTPException(403, 'Only the verified student account can be migrated.')
    try:
        changed = users.update_one({'_id': academic_id, '$or': [{'campusUserId': {'$exists': False}}, {'campusUserId': None}, {'campusUserId': identity['campusId']}]}, {'$set': {'campusUserId': identity['campusId'], 'updatedAt': utc_now()}})
    except DuplicateKeyError:
        raise HTTPException(409, 'This campus account already owns another workspace.')
    if not changed.matched_count: raise HTTPException(409, 'The workspace ownership changed. Retry verification.')
    return reply(users.find_one({'_id': academic_id}), identity)
