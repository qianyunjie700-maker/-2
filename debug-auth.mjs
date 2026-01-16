// 401错误调试脚本 - TypeScript格式
// 用于测试登录流程和token获取

import { apiService } from './services/api';

// 测试登录流程
async function testLogin() {
  console.log('=== 测试登录流程 ===');
  
  try {
    // 等待apiService初始化并获取CSRF令牌
    console.log('1. 等待apiService初始化...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. 尝试登录
    console.log('\n2. 尝试登录...');
    const loginResponse = await apiService.post('/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    console.log('登录响应:', {
      status: 200,
      data: loginResponse
    });
    
    if (loginResponse.success && loginResponse.data?.access_token) {
      const token = loginResponse.data.access_token;
      console.log('\n✅ 登录成功，获取到token:', token);
      
      // 3. 测试使用token访问受保护接口
      console.log('\n3. 测试使用token访问受保护接口...');
      const testResponse = await apiService.get('/users');
      
      console.log('接口响应:', {
        status: 200,
        data: testResponse
      });
      
    } else {
      console.log('\n❌ 登录失败，未获取到token');
    }
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

// 运行测试
testLogin().catch(console.error);