const axios = require('axios');

async function testLoginWithCSRF() {
  console.log('=== 测试登录功能（带CSRF令牌）===\n');
  
  try {
    const baseURL = 'http://localhost:3001';
    const axiosInstance = axios.create({ baseURL, withCredentials: true });
    
    // 1. 首先获取CSRF令牌
    console.log('1. 获取CSRF令牌...');
    const getResponse = await axiosInstance.get('/');
    
    // 从响应头中提取CSRF令牌
    const csrfToken = getResponse.headers['x-csrf-token'];
    console.log(`CSRF令牌: ${csrfToken}`);
    
    if (!csrfToken) {
      console.error('❌ 未获取到CSRF令牌!');
      return;
    }
    
    // 2. 使用CSRF令牌发送登录请求
    console.log('\n2. 发送登录请求...');
    console.log('用户名: admin');
    console.log('密码: admin123');
    
    const loginResponse = await axiosInstance.post('/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    }, {
      headers: {
        'X-CSRF-Token': csrfToken
      }
    });
    
    console.log('\n✅ 登录成功!');
    console.log('响应:', JSON.stringify(loginResponse.data, null, 2));
    
  } catch (error) {
    console.log('\n❌ 登录失败:');
    if (error.response) {
      console.log('状态码:', error.response.status);
      console.log('响应:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('错误:', error.message);
    }
  }
}

testLoginWithCSRF();
