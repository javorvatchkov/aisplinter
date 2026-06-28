import { nanoid } from 'nanoid';

export function generateDevKey() {
  return `aisplinter_dev_${nanoid(32)}`;
}

export function generateSessionToken() {
  return `aisplinter_sess_${nanoid(48)}`;
}
