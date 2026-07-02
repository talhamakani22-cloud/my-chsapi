const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');

wrapper(axios);
const cookieJar = new tough.CookieJar();

const api = axios.create({
  baseURL: 'http://localhost:1001',
  withCredentials: true,
  jar: cookieJar
});

async function testAuthFlow() {
  try {
    // 1. Login
    const loginRes = await api.post('/api/login', {
      username: 'admin',
      password: 'password'
    });
    console.log('Login:', loginRes.data);

    // 2. Access protected route
    const dashboardRes = await api.get('/api/dashboard');
    console.log('Dashboard:', dashboardRes.data);

    // 3. Logout
    const logoutRes = await api.post('/api/logout');
    console.log('Logout:', logoutRes.data);

    // 4. Try to access protected route again
    try {
      await api.get('/api/dashboard');
    } catch (err) {
      console.log('Dashboard after logout:', err.response.data);
    }
  } catch (err) {
    console.error('Error:', err.response ? err.response.data : err.message);
  }
}

testAuthFlow();
