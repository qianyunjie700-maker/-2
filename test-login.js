// 测试登录功能
import axios from 'axios';

async function testLogin() {
  try {
    // 测试登录请求
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'testuser123456',
      password: 'testpassword123456'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    console.log('登录请求成功:', loginResponse.data);

    if (loginResponse.data.success && loginResponse.data.data) {
      console.log('登录成功，获取到用户信息:', loginResponse.data.data.user);
      console.log('登录成功，获取到token:', loginResponse.data.data.access_token);
    } else {
      console.log('登录失败，服务器返回:', loginResponse.data);
    }

  } catch (error) {
    console.error('登录请求失败:', error.message);
    if (error.response) {
      console.error('服务器返回状态码:', error.response.status);
      console.error('服务器返回数据:', error.response.data);
      console.error('请求头:', error.response.config.headers);
    }
  }
}

// 执行测试
testLogin();