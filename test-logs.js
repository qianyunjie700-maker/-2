// 测试登录和获取操作日志的完整流程
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

async function testLogsFlow() {
  try {
    console.log('=== 测试登录和获取操作日志 ===');
    
    // 1. 登录
    console.log('\n1. 登录...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data.success) {
      console.log('   ✅ 登录成功！');
      const token = loginResponse.data.data.access_token;
      console.log('   - Token:', token);
      
      // 2. 获取操作日志
      console.log('\n2. 获取操作日志...');
      const logsResponse = await axios.get(`${API_BASE_URL}/operation-logs`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (logsResponse.data.success) {
        console.log('   ✅ 操作日志请求成功！');
        console.log('   - 日志总数:', logsResponse.data.data?.total || 0);
        console.log('   - 日志列表格式:', logsResponse.data.data?.logs ? '包含logs字段' : '不包含logs字段');
        if (logsResponse.data.data?.logs && logsResponse.data.data.logs.length > 0) {
          console.log('   - 前5条日志:');
          logsResponse.data.data.logs.slice(0, 5).forEach((log, index) => {
            console.log(`     ${index + 1}. ${log.operation_type} - ${log.details?.description || '无描述'}`);
          });
        } else {
          console.log('   - 没有找到日志');
        }
      } else {
        console.log('   ❌ 操作日志请求失败');
        console.log('   - 错误:', logsResponse.data);
      }
      
    } else {
      console.log('   ❌ 登录失败');
      console.log('   - 错误:', loginResponse.data);
    }
    
  } catch (error) {
    console.log('\n❌ 测试过程中出现错误:', error.message);
    if (error.response) {
      console.log('   - 状态码:', error.response.status);
      console.log('   - 响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  console.log('\n=== 测试完成 ===');
}

testLogsFlow();