const axios = require('axios');
const https = require('https');

async function testCSRFLogin() {
  console.log('=== 测试登录功能（完整CSRF处理）===\n');
  
  try {
    const baseURL = 'http://localhost:3001';
    
    // 创建axios实例，启用cookie处理
    const axiosInstance = axios.create({
      baseURL,
      withCredentials: true, // 自动处理cookie
      timeout: 5000
    });
    
    // 1. 发送GET请求获取CSRF cookie和令牌
    console.log('1. 发送GET请求获取CSRF令牌和cookie...');
    const getResponse = await axiosInstance.get('/');
    
    console.log('\nGET请求响应:');
    console.log('状态码:', getResponse.status);
    console.log('Cookie:', getResponse.headers['set-cookie']);
    console.log('X-CSRF-Token:', getResponse.headers['x-csrf-token']);
    
    // 从响应头中提取CSRF令牌
    const csrfToken = getResponse.headers['x-csrf-token'];
    if (!csrfToken) {
      console.error('\n❌ 未获取到CSRF令牌!');
      return;
    }
    
    // 2. 使用获取到的CSRF令牌和cookie发送登录请求
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
      console.log('响应头:', error.response.headers);
    } else if (error.request) {
      console.log('请求发送成功但未收到响应:', error.request);
    } else {
      console.log('错误:', error.message);
      console.log('错误详情:', error);
    }
  }
}

testCSRFLogin();
