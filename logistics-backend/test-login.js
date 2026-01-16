const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { AuthService } = require('./dist/auth/services/auth.service');

async function testLogin() {
  console.log('=== 测试登录功能 ===\n');
  
  try {
    // 创建Nest应用实例
    const app = await NestFactory.create(AppModule);
    await app.init();
    
    // 获取AuthService实例
    const authService = app.get(AuthService);
    
    // 测试用户信息（使用已知存在的用户）
    const testUsers = [
      { username: 'admin', password: 'password' }, // 尝试默认密码
      { username: 'testuser', password: 'password' }, // 尝试默认密码
      { username: 'admin', password: '123456' }, // 尝试简单密码
    ];
    
    for (const testUser of testUsers) {
      console.log(`测试用户: ${testUser.username}`);
      console.log(`密码: ${testUser.password}`);
      
      try {
        const user = await authService.validateUser(testUser.username, testUser.password);
        
        if (user) {
          console.log('✅ 验证成功!');
          console.log('用户信息:', user);
          
          // 测试生成JWT token
          const token = await authService.login(user);
          console.log('生成的Token:', token.access_token);
        } else {
          console.log('❌ 验证失败: 用户名或密码错误');
        }
      } catch (error) {
        console.log('❌ 验证失败:', error.message);
      }
      
      console.log('---\n');
    }
    
    await app.close();
  } catch (error) {
    console.log('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }
}

testLogin();
