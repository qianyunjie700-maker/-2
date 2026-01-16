// 测试前端token获取和API请求功能
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// 模拟localStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value.toString();
  }

  removeItem(key) {
    delete this.store[key];
  }

  clear() {
    this.store = {};
  }
}

// 创建全局localStorage对象
global.localStorage = new MockLocalStorage();

// 模拟store的getInitialAuthState函数
function getInitialAuthState() {
  const storedUser = localStorage.getItem('user');
  const isAuthenticated = localStorage.getItem('isAuthenticated');
  const storedToken = localStorage.getItem('token');

  console.log('从localStorage获取的用户信息:', storedUser);
  console.log('从localStorage获取的认证状态:', isAuthenticated);
  console.log('从localStorage获取的token:', storedToken);

  if (isAuthenticated && storedUser && storedToken) {
    return {
      isAuthenticated: true,
      user: JSON.parse(storedUser),
      token: storedToken || null
    };
  }

  return {
    isAuthenticated: false,
    user: null,
    token: null
  };
}

// 模拟store
const createStore = (initialState) => {
  let state = initialState;
  return {
    getState: () => state
  };
};

const useLogisticsStore = createStore({
  auth: getInitialAuthState(),
});

// 测试获取token
console.log('\n=== 测试获取token ===');
const token = useLogisticsStore.getState().auth.token;
console.log('从store获取的token:', token);

// 测试API请求
if (token) {
  console.log('\n=== 测试API请求 ===');
  const axiosInstance = axios.create({
    baseURL: 'http://localhost:3001/api',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  });

  axiosInstance.get('/users')
    .then(response => {
      console.log('✅ API请求成功:', response.data);
    })
    .catch(error => {
      console.log('❌ API请求失败:', error.response?.status, error.response?.statusText);
      console.log('错误数据:', error.response?.data);
      console.log('请求头:', error.config?.headers);
    });
} else {
  console.log('\n❌ 没有找到token，无法测试API请求');
  
  // 如果没有token，尝试手动输入token进行测试
  console.log('\n=== 手动测试API请求 ===');
  const manualToken = ''; // 这里可以手动输入token进行测试
  
  if (manualToken) {
    const axiosInstance = axios.create({
      baseURL: 'http://localhost:3001/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${manualToken}`
      },
    });

    axiosInstance.get('/users')
      .then(response => {
        console.log('✅ API请求成功:', response.data);
      })
      .catch(error => {
        console.log('❌ API请求失败:', error.response?.status, error.response?.statusText);
        console.log('错误数据:', error.response?.data);
        console.log('请求头:', error.config?.headers);
      });
  }
}
