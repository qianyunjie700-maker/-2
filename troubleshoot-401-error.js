// 401错误排查工具
import axios from 'axios';

// 模拟用户的实际环境
const userEnvironment = {
  origin: 'http://192.168.128.1:3000',
  targetUrl: 'http://192.168.128.1:3000/api/auth/login',
  credentials: {
    username: 'testuser123456',
    password: 'testpassword123456'
  }
};

// 详细的错误排查函数
async function troubleshoot401Error() {
  console.log('=== 401错误排查工具 ===');
  console.log('测试时间:', new Date().toLocaleString());
  console.log('用户环境:', JSON.stringify(userEnvironment, null, 2));
  
  try {
    // 1. 检查网络连通性
    console.log('\n1. 检查网络连通性');
    const pingResponse = await axios.get('http://192.168.128.1:3000');
    console.log('✅ 前端服务可达');
    console.log('前端状态码:', pingResponse.status);
    
    // 2. 测试直接访问后端（跳过前端代理）
    console.log('\n2. 测试直接访问后端');
    const directBackendResponse = await axios.get('http://localhost:3002/api', {
      headers: {
        'Origin': userEnvironment.origin
      },
      timeout: 5000
    });
    console.log('✅ 后端服务可达');
    console.log('后端状态码:', directBackendResponse.status);
    
    // 3. 测试登录请求（直接访问后端）
    console.log('\n3. 测试登录请求（直接访问后端）');
    const directLoginResponse = await axios.post('http://localhost:3002/api/auth/login', {
      username: userEnvironment.credentials.username,
      password: userEnvironment.credentials.password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': userEnvironment.origin
      },
      withCredentials: true
    });
    console.log('✅ 直接登录请求成功');
    console.log('后端登录状态码:', directLoginResponse.status);
    console.log('后端登录响应:', JSON.stringify(directLoginResponse.data, null, 2));
    
    // 4. 测试通过前端代理访问登录API
    console.log('\n4. 测试通过前端代理访问登录API');
    const proxyLoginResponse = await axios.post(userEnvironment.targetUrl, {
      username: userEnvironment.credentials.username,
      password: userEnvironment.credentials.password
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': userEnvironment.origin
      },
      withCredentials: true
    });
    console.log('✅ 代理登录请求成功');
    console.log('代理登录状态码:', proxyLoginResponse.status);
    console.log('代理登录响应:', JSON.stringify(proxyLoginResponse.data, null, 2));
    
    // 5. 测试使用token访问受保护资源
    console.log('\n5. 测试使用token访问受保护资源');
    const token = proxyLoginResponse.data.data.access_token;
    const protectedResponse = await axios.get('http://192.168.128.1:3000/api/orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Origin': userEnvironment.origin
      },
      withCredentials: true
    });
    console.log('✅ 访问受保护资源成功');
    console.log('受保护资源状态码:', protectedResponse.status);
    
    console.log('\n=== 排查完成 ===');
    console.log('✅ 所有测试通过！系统工作正常。');
    console.log('\n建议：');
    console.log('1. 清除浏览器缓存和本地存储后重试');
    console.log('2. 使用无痕模式测试登录功能');
    console.log('3. 检查浏览器控制台是否有其他错误');
    
  } catch (error) {
    console.error('\n❌ 排查过程中发现错误');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
      console.error('响应头:', JSON.stringify(error.response.headers, null, 2));
      console.error('请求配置:', JSON.stringify(error.config, null, 2));
    } else if (error.request) {
      console.error('请求已发送但没有收到响应:', error.request);
    } else {
      console.error('请求配置错误:', error.message);
    }
    
    console.error('\n=== 错误分析 ===');
    if (error.response && error.response.status === 401) {
      console.error('可能的原因:');
      console.error('1. 用户名或密码错误');
      console.error('2. CORS配置问题（已修复）');
      console.error('3. 浏览器缓存问题');
      console.error('4. 本地存储的token无效');
      console.error('5. 网络代理问题');
    }
    
    console.error('\n=== 解决方案建议 ===');
    console.error('1. 清除浏览器缓存和本地存储');
    console.error('2. 关闭浏览器，重新打开后重试');
    console.error('3. 使用无痕模式测试');
    console.error('4. 检查网络连接是否稳定');
    console.error('5. 确认用户名和密码是否正确');
  }
}

// 执行排查
troubleshoot401Error();