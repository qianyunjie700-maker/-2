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

async function resetPassword() {
  console.log('=== 重置用户密码 ===\n');
  
  // 新密码设置
  const newPassword = 'admin123'; // 设置一个已知的密码
  
  try {
    // 生成密码哈希
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`新密码: ${newPassword}`);
    console.log(`哈希值: ${hashedPassword}\n`);
    
    // 连接数据库
    connection.connect(err => {
      if (err) {
        console.error('数据库连接失败:', err);
        return;
      }
      console.log('数据库连接成功!\n');
      
      // 重置admin用户密码
      const updateSql = 'UPDATE users SET password = ? WHERE username = "admin"';
      connection.query(updateSql, [hashedPassword], (err, results) => {
        if (err) {
          console.error('更新密码失败:', err);
          connection.end();
          return;
        }
        
        console.log(`✅ 成功更新 ${results.affectedRows} 个用户的密码!`);
        console.log(`用户名: admin`);
        console.log(`新密码: ${newPassword}`);
        
        // 验证更新结果
        connection.query('SELECT username, password FROM users WHERE username = "admin"', async (err, results) => {
          if (err) {
            console.error('验证密码失败:', err);
            connection.end();
            return;
          }
          
          if (results.length > 0) {
            const user = results[0];
            console.log(`\n验证更新后的密码:`);
            console.log(`用户名: ${user.username}`);
            console.log(`数据库中的密码: ${user.password}`);
            
            // 测试密码验证
            const match = await bcrypt.compare(newPassword, user.password);
            console.log(`密码验证结果: ${match ? '✅ 匹配' : '❌ 不匹配'}`);
          }
          
          connection.end();
        });
      });
    });
  } catch (error) {
    console.error('生成密码哈希失败:', error);
  }
}

resetPassword();
