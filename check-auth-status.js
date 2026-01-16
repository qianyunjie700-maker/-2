// 检查前端认证状态的脚本
console.log('=== 检查前端认证状态 ===');

// 模拟获取本地存储数据
const isAuthenticated = localStorage.getItem('isAuthenticated');
const token = localStorage.getItem('token');
const user = localStorage.getItem('user');

console.log('认证状态:', isAuthenticated ? '已认证' : '未认证');
console.log('令牌是否存在:', token ? '是' : '否');
console.log('用户信息是否存在:', user ? '是' : '否');

if (token) {
  console.log('令牌长度:', token.length);
  console.log('令牌前50字符:', token.substring(0, 50) + '...');
  
  // 解析令牌（不验证签名，仅用于检查结构）
  try {
    const [header, payload, signature] = token.split('.');
    const decodedPayload = JSON.parse(atob(payload));
    console.log('令牌过期时间:', new Date(decodedPayload.exp * 1000).toString());
    console.log('当前时间:', new Date().toString());
    console.log('令牌是否过期:', decodedPayload.exp < Date.now() / 1000 ? '是' : '否');
  } catch (e) {
    console.log('令牌解析失败:', e.message);
  }
}

if (user) {
  try {
    const userData = JSON.parse(user);
    console.log('用户名:', userData.username);
    console.log('用户角色:', userData.role);
  } catch (e) {
    console.log('用户信息解析失败:', e.message);
  }
}

console.log('=== 检查完成 ===');

// 提示信息
console.log('\n如果令牌不存在或已过期，请重新登录系统。');
console.log('使用管理员账号登录: admin / admin123');
console.log('登录后再次检查认证状态。');
