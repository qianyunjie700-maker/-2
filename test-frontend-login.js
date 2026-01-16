// 测试前端登录流程
import axios from 'axios';

// 模拟前端的登录流程
async function testFrontendLoginFlow() {
  try {
    // 清除可能存在的本地存储数据
    console.log('=== 开始模拟前端登录流程 ===');
    console.log('1. 清除可能存在的本地存储数据');
    
    // 模拟发送登录请求
    console.log('\n2. 发送登录请求');
    console.log('   请求URL: http://localhost:3000/api/auth/login');
    console.log('   请求方法: POST');
    console.log('   请求头: { "Content-Type": "application/json" }');
    console.log('   请求体: { "username": "testuser123456", "password": "testpassword123456" }');

    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'testuser123456',
      password: 'testpassword123456'
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    });

    console.log('\n3. 登录请求响应');
    console.log('   状态码:', loginResponse.status);
    console.log('   响应数据:', loginResponse.data);

    if (loginResponse.data.success && loginResponse.data.data) {
      console.log('\n4. 登录成功');
      console.log('   用户信息:', loginResponse.data.data.user);
      console.log('   Token:', loginResponse.data.data.access_token);
      console.log('\n5. 测试使用token访问受保护资源');
      
      // 模拟使用token访问受保护资源
      const protectedResponse = await axios.get('http://localhost:3000/api/orders', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginResponse.data.data.access_token}`
        },
        withCredentials: true
      });
      
      console.log('\n6. 受保护资源访问响应');
      console.log('   状态码:', protectedResponse.status);
      console.log('   响应数据:', protectedResponse.data);
      
      if (protectedResponse.data.success) {
        console.log('\n✅ 所有测试通过！登录功能和受保护资源访问都正常工作。');
      } else {
        console.log('\n❌ 受保护资源访问失败:', protectedResponse.data.message);
      }
      
    } else {
      console.log('\n❌ 登录失败:', loginResponse.data.message);
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.response) {
      console.error('   状态码:', error.response.status);
      console.error('   响应数据:', error.response.data);
      console.error('   请求头:', error.response.config.headers);
    }
  }
}

// 执行测试
testFrontendLoginFlow();