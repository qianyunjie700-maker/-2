// 测试认证API的脚本
import axios from 'axios';

// 测试后端API地址
const API_BASE_URL = 'http://localhost:3001';

// 测试管理员账号
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function testAuthFlow() {
  console.log('=== 测试认证流程 ===\n');
  
  let token = null;
  
  try {
    // 1. 测试登录API
    console.log('1. 测试登录API...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, ADMIN_CREDENTIALS);
    
    if (loginResponse.data && loginResponse.data.access_token) {
      token = loginResponse.data.access_token;
      console.log('✅ 登录成功！');
      console.log('   令牌:', token.substring(0, 50) + '...');
      console.log('   用户信息:', JSON.stringify(loginResponse.data.user, null, 2));
    } else {
      console.log('❌ 登录失败：未返回令牌');
      return;
    }
    
    // 2. 测试带令牌的API请求
    console.log('\n2. 测试带令牌的API请求...');
    
    // 测试获取用户列表
    console.log('   - 获取用户列表...');
    const usersResponse = await axios.get(`${API_BASE_URL}/users`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (usersResponse.data.success) {
      console.log('   ✅ 用户列表请求成功！');
      console.log('   - 用户数量:', usersResponse.data.data.users.length);
    } else {
      console.log('   ❌ 用户列表请求失败');
      console.log('   - 错误:', usersResponse.data);
    }
    
    // 测试获取操作日志
    console.log('\n   - 获取操作日志...');
    const logsResponse = await axios.get(`${API_BASE_URL}/operation-logs`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (logsResponse.data.success) {
      console.log('   ✅ 操作日志请求成功！');
      console.log('   - 日志数量:', logsResponse.data.data.length);
    } else {
      console.log('   ❌ 操作日志请求失败');
      console.log('   - 错误:', logsResponse.data);
    }
    
    // 3. 测试不带令牌的API请求
    console.log('\n3. 测试不带令牌的API请求...');
    try {
      await axios.get(`${API_BASE_URL}/users`);
      console.log('   ❌ 应该返回401错误，但请求成功了');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('   ✅ 正确返回了401 Unauthorized错误');
      } else {
        console.log('   ❌ 返回了意外的错误:', error.response ? error.response.status : error.message);
      }
    }
    
  } catch (error) {
    console.log('\n❌ 测试过程中出现错误:', error.message);
    if (error.response) {
      console.log('   - 状态码:', error.response.status);
      console.log('   - 响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n=== 测试完成 ===');
}

testAuthFlow();
