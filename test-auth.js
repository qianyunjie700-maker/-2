import axios from 'axios';

// 配置API客户端
const apiClient = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 测试用户信息（使用随机用户名避免冲突）
const testUser = {
  username: 'testuser' + Date.now(),
  password: 'Test1234',
  email: 'testuser' + Date.now() + '@example.com'
};

// 测试认证流程
async function testAuthFlow() {
  console.log('开始测试认证流程...');

  try {
    // 1. 注册测试用户
    console.log('\n1. 注册测试用户...');
    const registerResponse = await apiClient.post('/auth/register', testUser);
    console.log('注册成功:', registerResponse.data);

    // 2. 登录获取token
    console.log('\n2. 登录获取token...');
    const loginResponse = await apiClient.post('/auth/login', {
      username: testUser.username,
      password: testUser.password
    });
    console.log('登录成功:', loginResponse.data);

    const token = loginResponse.data.data.access_token;
    console.log('获取到的token:', token);

    // 3. 设置token到请求头
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // 4. 访问受保护的API端点
    console.log('\n3. 访问受保护的API端点...');
    const ordersResponse = await apiClient.get('/orders');
    console.log('访问成功:', ordersResponse.data);

    console.log('\n✅ 认证流程测试成功！');
  } catch (error) {
    console.log('\n❌ 测试失败:', error.message);
    if (error.response) {
      console.log('响应状态:', error.response.status);
      console.log('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testAuthFlow();
