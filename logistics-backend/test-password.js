const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 创建数据库连接
const connection = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'logistics'
});

async function testPassword() {
  console.log('=== 测试密码验证流程 ===\n');
  
  // 连接数据库
  connection.connect(err => {
    if (err) {
      console.error('数据库连接失败:', err);
      return;
    }
    console.log('数据库连接成功!\n');
    
    // 查询用户和密码
    connection.query('SELECT id, username, password FROM users WHERE username = "admin" OR username = "testuser" LIMIT 5;', async (err, results) => {
      if (err) {
        console.error('查询用户表失败:', err);
        connection.end();
        return;
      }
      
      console.log('数据库中的用户信息:');
      console.table(results.map(user => ({ 
        id: user.id, 
        username: user.username, 
        password_length: user.password.length,
        password: user.password 
      })));
      
      console.log('\n=== 测试密码验证 ===\n');
      
      // 测试不同的密码
      const testPasswords = ['password', '123456', 'admin123', 'test123'];
      
      for (const user of results) {
        console.log(`\n测试用户: ${user.username}`);
        console.log(`数据库中的密码: ${user.password}`);
        
        for (const testPassword of testPasswords) {
          try {
            const match = await bcrypt.compare(testPassword, user.password);
            console.log(`密码 "${testPassword}": ${match ? '✅ 匹配' : '❌ 不匹配'}`);
          } catch (error) {
            console.error(`验证密码 "${testPassword}"时出错:`, error.message);
          }
        }
        
        // 测试生成新的bcrypt哈希值
        try {
          const newHash = await bcrypt.hash('password', 10);
          console.log(`\n新生成的密码哈希: ${newHash}`);
          console.log(`新哈希与旧哈希是否相同: ${newHash === user.password}`);
          
          // 测试新哈希的验证
          const match = await bcrypt.compare('password', newHash);
          console.log(`使用新哈希验证密码 "password": ${match ? '✅ 匹配' : '❌ 不匹配'}`);
        } catch (error) {
          console.error('生成新哈希时出错:', error.message);
        }
      }
      
      connection.end();
    });
  });
}

testPassword();
