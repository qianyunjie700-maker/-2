// 完整的物流API测试脚本，包含登录和CSRF令牌处理
import axios from 'axios';
import { create } from 'zustand';

// 创建一个简单的store来存储认证信息
const useTestStore = create((set) => ({
  token: null,
  csrfToken: null,
  setToken: (token) => set({ token }),
  setCsrfToken: (csrfToken) => set({ csrfToken }),
}));

// 创建axios实例
const axiosInstance = axios.create({
  baseURL: 'http://localhost:3001/api',
  timeout: 10000,
  withCredentials: true,
});

// 请求拦截器
axiosInstance.interceptors.request.use(
  (config) => {
    // 添加CSRF令牌
    const csrfToken = useTestStore.getState().csrfToken;
    if (csrfToken && !config.url?.startsWith('/auth/csrf-token')) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
    
    // 添加认证token
    const token = useTestStore.getState().token;
    if (token && !config.url?.startsWith('/auth/')) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response) => {
    // 保存CSRF令牌
    const csrfTokenHeader = response.headers['x-csrf-token'];
    if (csrfTokenHeader) {
      useTestStore.getState().setCsrfToken(csrfTokenHeader);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 测试物流API
async function testLogisticsAPI() {
  try {
    console.log('=== 开始测试物流API ===');
    
    // 1. 获取CSRF令牌
    console.log('1. 获取CSRF令牌...');
    const csrfResponse = await axiosInstance.get('/auth/csrf-token');
    const csrfToken = csrfResponse.headers['x-csrf-token'];
    console.log('   CSRF令牌:', csrfToken);
    
    // 2. 登录
    console.log('2. 尝试登录...');
    const loginResponse = await axiosInstance.post('/auth/login', {
      username: 'admin',
      password: 'Admin@123'
    });
    
    if (loginResponse.data.success && loginResponse.data.data) {
      const token = loginResponse.data.data.access_token;
      console.log('   登录成功，获取到token:', token);
      useTestStore.getState().setToken(token);
    } else {
      console.log('   登录失败:', loginResponse.data.message);
      return;
    }
    
    // 3. 测试单个物流查询
    console.log('3. 测试单个物流查询...');
    const logisticsResponse = await axiosInstance.post('/logistics-proxy/query', {
      kdgs: 'sf', // 顺丰速运
      kddh: 'SF1234567890' // 测试运单号
    });
    
    console.log('   物流查询响应:', JSON.stringify(logisticsResponse.data, null, 2));
    
    // 4. 测试批量物流查询
    console.log('4. 测试批量物流查询...');
    const batchResponse = await axiosInstance.post('/logistics-proxy/select', {
      taskname: 'test-task',
      pageno: 1
    });
    
    console.log('   批量查询响应:', JSON.stringify(batchResponse.data, null, 2));
    
    console.log('=== 物流API测试完成 ===');
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
