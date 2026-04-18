import axios from 'axios';

const API = axios.create({
    baseURL: 'http://localhost:5000/api'
});

// ✅ GET
export const getIdentities = () => API.get('/identities');

// ✅ REGISTER
export const registerDID = (data) => API.post('/register', data);

// ✅ ACTIVATE (FIXED 🔥)
export const activateDID = (data) => API.post('/activate-did', data);

// ✅ DEACTIVATE (NEW 🔥)
export const deactivateDID = (data) => API.post('/deactivate-did', data);

// ✅ VC
export const issuePermit = (data) => API.post('/issue-permit', data);
export const verifyPermit = (vc) => API.post('/verify-permit', { vc });

export const checkAccess = (data) => API.post('/check-access', data);