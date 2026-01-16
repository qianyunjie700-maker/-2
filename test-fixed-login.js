// 测试修复后的登录功能
import axios from 'axios';

// 测试使用用户报告的源地址登录
async function testFixedLogin() {
  try {
    console.log('=== 测试修复后的登录功能 ===');
    console.log('测试源地址:', 'http://192.168.128.1:3000');
    console.log('测试目标:', 'http://192.168.128.1:3000/api/auth/login');
    
    // 发送登录请求
    const response = await axios.post('http://192.168.128.1:3000/api/auth/login', {
      username: 'testuser123456',
      password: 'testpassword123456'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://192.168.128.1:3000' // 设置请求源，模拟用户的环境
      },
      withCredentials: true
    });
    
    console.log('\n✅ 登录请求成功');
    console.log('响应状态码:', response.status);
    console.log('响应数据:', JSON.stringify(response.data, null, 2));
    
    if (response.data.success && response.data.data) {
      console.log('\n✅ 登录成功！');
      console.log('用户信息:', JSON.stringify(response.data.data.user, null, 2));
      console.log('Token:', response.data.data.access_token);
    }
    
  } catch (error) {
    console.error('\n❌ 登录请求失败');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
      console.error('请求头:', JSON.stringify(error.response.config.headers, null, 2));
    } else if (error.request) {
      console.error('请求已发送但没有收到响应:', error.request);
    } else {
      console.error('请求配置错误:', error.message);
    }
  }
}

// 执行测试
testFixedLogin();