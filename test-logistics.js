// 简单的物流API测试脚本
import axios from 'axios';


// 创建axios实例
const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
  withCredentials: true
});

// 测试物流API
async function testLogisticsAPI() {
  try {
    console.log('=== 开始测试物流API ===');
    
    // 1. 首先获取CSRF令牌
    console.log('1. 获取CSRF令牌...');
    const csrfResponse = await api.get('/auth/csrf-token');
    const csrfToken = csrfResponse.headers['x-csrf-token'];
    console.log('CSRF令牌:', csrfToken);
    
    // 2. 使用获取到的CSRF令牌登录
    console.log('\n2. 登录...');
    const loginResponse = await api.post('/auth/login', 
      { username: 'admin', password: 'Admin@123' },
      { headers: { 'X-CSRF-Token': csrfToken } }
    );
    
    console.log('登录响应:', loginResponse.data);
    
    if (loginResponse.data.success && loginResponse.data.data) {
      // 3. 测试单个物流查询API
      console.log('\n3. 测试单个物流查询API...');
      const logisticsResponse = await api.post('/logistics-proxy/query', 
        { kdgs: 'sf', kddh: 'SF1234567890123' },
        { headers: { 'X-CSRF-Token': csrfToken } }
      );
      
      console.log('物流查询响应:', logisticsResponse.data);
      
      // 4. 测试批量物流查询API
      console.log('\n4. 测试批量物流查询API...');
      const batchResponse = await api.post('/logistics-proxy/select', 
        { taskname: 'test-task', pageno: 1 },
        { headers: { 'X-CSRF-Token': csrfToken } }
      );
      
      console.log('批量查询响应:', batchResponse.data);
      
      console.log('\n=== 物流API测试完成 ===');
    } else {
      console.log('登录失败:', loginResponse.data.message);
    }
  } catch (error) {
    console.error('测试失败:', error.message);
    if (error.response) {
      console.error('响应状态码:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 执行测试
testLogisticsAPI();
