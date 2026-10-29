import test from 'node:test';
import assert from 'node:assert/strict';
import {eventStart} from '../src/lib/calendar.js';
test('event calendar uses the entered class time in India Standard Time',()=>assert.equal(eventStart({date:'2026-10-24',time:'09:00'}).toISOString(),'2026-10-24T03:30:00.000Z'));
test('stored UTC dates resolve to their actual university calendar day',()=>assert.equal(eventStart({date:'2026-10-23T23:30:00Z',time:'14:00'}).toISOString(),'2026-10-24T08:30:00.000Z'));
test('calendar refuses missing dates or unknown event times',()=>assert.throws(()=>eventStart({date:'bad',time:'unknown'}),/not available/));
