// 前端登录调试脚本
// 在浏览器控制台中运行此脚本进行调试

console.log('=== 前端登录调试工具 ===');

// 1. 检查当前URL和网络环境
console.log('当前页面URL:', window.location.href);
console.log('前端应用IP:', window.location.hostname);
console.log('前端应用端口:', window.location.port);

// 2. 检查本地存储的认证信息
console.log('\n=== 本地存储检查 ===');
const localStorageKeys = Object.keys(localStorage);
console.log('本地存储键:', localStorageKeys);

if (localStorageKeys.includes('isAuthenticated')) {
  console.log('认证状态:', localStorage.getItem('isAuthenticated'));
}
if (localStorageKeys.includes('user')) {
  console.log('用户信息:', JSON.parse(localStorage.getItem('user')));
}
if (localStorageKeys.includes('token')) {
  console.log('Token存在:', !!localStorage.getItem('token'));
  console.log('Token前20字符:', localStorage.getItem('token')?.substring(0, 20) + '...');
}

// 3. 检查API服务配置
console.log('\n=== API服务配置检查 ===');
try {
  // 尝试访问apiService（如果在全局作用域）
  if (typeof window.apiService !== 'undefined') {
    console.log('API服务已初始化:', true);
    console.log('BaseURL:', window.apiService.axiosInstance.defaults.baseURL);
    console.log('超时时间:', window.apiService.axiosInstance.defaults.timeout);
    console.log('请求头:', window.apiService.axiosInstance.defaults.headers);
  } else {
    console.log('API服务未在全局作用域找到');
  }
} catch (error) {
  console.log('API服务检查错误:', error.message);
}

// 4. 直接测试登录请求
async function testLoginRequest() {
  console.log('\n=== 测试登录请求 ===');
  
  const testCredentials = {
    username: 'testuser1768286173820',
    password: 'Test1234'
  };
  
  console.log('测试凭证:', testCredentials);
  
  try {
    // 直接使用fetch API测试
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testCredentials)
    });
    
    console.log('响应状态:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    const responseData = await response.json();
    console.log('响应数据:', responseData);
    
    // 检查是否是401错误
    if (response.status === 401) {
      console.log('❌ 登录失败: 401未授权');
      console.log('可能原因:', [
        '1. 用户名或密码错误',
        '2. 请求格式不正确',
        '3. 代理配置问题',
        '4. CORS配置问题',
        '5. 浏览器缓存问题'
      ]);
      
      // 测试直接访问后端
      testDirectBackendAccess();
    } else if (response.status === 201) {
      console.log('✅ 登录成功！');
      console.log('Token:', responseData.data.access_token);
    }
  } catch (error) {
    console.log('请求错误:', error.message);
    console.log('错误类型:', error.name);
  }
}

// 5. 测试直接访问后端
async function testDirectBackendAccess() {
  console.log('\n=== 测试直接访问后端 ===');
  
  const testCredentials = {
    username: 'testuser1768286173820',
    password: 'Test1234'
  };
  
  try {
    const response = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': window.location.origin
      },
      body: JSON.stringify(testCredentials),
      mode: 'cors'
    });
    
    console.log('直接访问后端状态:', response.status);
    const responseData = await response.json();
    console.log('直接访问后端数据:', responseData);
    
    if (response.status === 201) {
      console.log('✅ 直接访问后端成功！问题出在前端配置');
      console.log('Token:', responseData.data.access_token);
      
      // 保存认证信息
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('user', JSON.stringify(responseData.data.user));
      localStorage.setItem('token', responseData.data.access_token);
      
      console.log('✅ 认证信息已保存到本地存储');
      console.log('请刷新页面后重试');
    }
  } catch (error) {
    console.log('直接访问后端错误:', error.message);
  }
}

// 6. 运行所有测试
function runAllTests() {
  console.log('\n=== 开始所有测试 ===');
  testLoginRequest();
}

// 导出函数以便在控制台中调用
window.debugLogin = {
  runAllTests,
  testLoginRequest,
  testDirectBackendAccess
};

console.log('\n=== 调试工具已加载 ===');
console.log('在控制台中运行以下命令进行测试:');
console.log('1. debugLogin.runAllTests() - 运行所有测试');
console.log('2. debugLogin.testLoginRequest() - 测试登录请求');
console.log('3. debugLogin.testDirectBackendAccess() - 直接访问后端');
console.log('\n=== 快速修复选项 ===');
console.log('运行以下命令清除缓存并重新登录:');
console.log('localStorage.clear(); sessionStorage.clear(); location.reload();');
