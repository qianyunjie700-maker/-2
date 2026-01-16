// 登录验证和令牌检查脚本
// 这个脚本可以在浏览器控制台中运行，用于检查登录状态和令牌信息

console.log('=== 智能物流看板 - 登录助手 ===');
console.log('当前时间:', new Date().toString());

// 检查本地存储中的认证信息
function checkLoginStatus() {
    console.log('\n1. 检查认证状态:');
    
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    console.log('   认证状态:', isAuthenticated);
    console.log('   令牌存在:', token ? '是' : '否');
    console.log('   用户信息存在:', user ? '是' : '否');
    
    if (token) {
        console.log('\n2. 检查令牌信息:');
        try {
            const [header, payload, signature] = token.split('.');
            const decodedPayload = JSON.parse(atob(payload));
            
            const expTime = new Date(decodedPayload.exp * 1000);
            const isExpired = decodedPayload.exp < Date.now() / 1000;
            
            console.log('   令牌前50字符:', token.substring(0, 50) + '...');
            console.log('   过期时间:', expTime.toString());
            console.log('   是否过期:', isExpired ? '是' : '否');
            console.log('   用户名:', decodedPayload.username);
            console.log('   用户角色:', decodedPayload.role);
            
        } catch (e) {
            console.log('   令牌解析失败:', e.message);
        }
    }
    
    if (user) {
        console.log('\n3. 检查用户信息:');
        try {
            const userData = JSON.parse(user);
            console.log('   用户名:', userData.username);
            console.log('   用户ID:', userData.id);
            console.log('   用户角色:', userData.role);
        } catch (e) {
            console.log('   用户信息解析失败:', e.message);
        }
    }
}

// 清除认证信息
function clearAuthData() {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('\n✅ 认证信息已清除');
}

// 执行检查
checkLoginStatus();

// 显示操作建议
console.log('\n=== 操作建议 ===');
console.log('1. 如果令牌已过期或不存在:');
console.log('   - 请重新登录系统');
console.log('   - 登录地址: http://localhost:3000/');
console.log('   - 管理员账号: admin / admin123');
console.log('\n2. 如果需要清除现有认证信息:');
console.log('   - 复制并执行: clearAuthData()');
console.log('   - 然后重新登录');
console.log('\n3. 登录后刷新页面:');
console.log('   - 确保所有API请求都包含正确的认证信息');
console.log('\n4. 避免使用网络IP:');
console.log('   - 使用 http://localhost:3000/ 而不是网络IP地址');
