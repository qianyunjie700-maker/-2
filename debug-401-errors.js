// 401错误调试脚本
// 用于测试登录流程和token获取

import axios from 'axios';
// 简单的测试，不使用store

// 创建一个简单的测试客户端
const testClient = axios.create({
  baseURL: 'http://192.168.128.1:3000',
  withCredentials: true // 允许携带cookie
});

// 测试登录流程
async function testLogin() {
  console.log('=== 测试登录流程 ===');
  
  try {
    // 1. 获取CSRF令牌
    console.log('1. 获取CSRF令牌...');
    const csrfResponse = await testClient.get('/auth/csrf-token');
    console.log('CSRF令牌获取成功:', {
      status: csrfResponse.status,
      headers: {
        'x-csrf-token': csrfResponse.headers['x-csrf-token'],
        'set-cookie': csrfResponse.headers['set-cookie']
      }
    });
    
    // 2. 尝试登录
    console.log('\n2. 尝试登录...');
    const loginResponse = await testClient.post('/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('登录响应:', {
      status: loginResponse.status,
      data: loginResponse.data
    });
    
    if (loginResponse.data.success && loginResponse.data.data.access_token) {
      const token = loginResponse.data.data.access_token;
      console.log('\n✅ 登录成功，获取到token:', token);
      
      // 3. 测试使用token访问受保护接口
      console.log('\n3. 测试使用token访问受保护接口...');
      const testResponse = await testClient.get('/api/users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      console.log('接口响应:', {
        status: testResponse.status,
        data: testResponse.data
      });
      
    } else {
      console.log('\n❌ 登录失败，未获取到token');
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
  }
}

// 运行测试
testLogin();