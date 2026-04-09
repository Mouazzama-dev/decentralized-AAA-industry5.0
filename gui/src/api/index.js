import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

export const getIdentities = () => API.get('/identities');
export const registerDID = (data) => API.post('/register', data);
export const issuePermit = (data) => API.post('/issue-permit', data);
export const verifyPermit = (vc) => API.post('/verify-permit', { vc });