import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { useLogisticsStore } from './store';
import { getCarrierCode } from '../types';

// 定义API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 定义物流API响应接口
export interface LogisticsApiResponse<T = any> {
  code: number;
  msg: T;
}

// 定义物流API参数接口
export interface CreateBatchTaskParams {
  appid: number;
  outerid: string;
  zffs: string;
  kdgs: string;
  kddh: string;
  isBackTaskName?: string;
}

export interface GetBatchResultParams {
  appid: number;
  outerid: string;
  pageno: number;
  taskname: string;
}

export interface GetSingleResultParams {
  kdgs: string;
  kddh: string;
}

// 定义物流数据接口
export interface LogisticsData {
  kddh: string;
  kdgs: string;
  wuliuzhuangtai: string;
  tiaoshu: number;
  fachushijian: string;
  zuixinshijian: string;
  zuihouwuliu: string;
  xiangxiwuliu: string;
  chaxunshijian: string;
  dingdanhao: string;
  wwlyuan: string;
}

export interface BatchResultData {
  jindu: number;
  totalpage: number;
  list: LogisticsData[];
}

// 定义缓存接口
interface CacheItem<T = any> {
  data: T;
  timestamp: number;
}

// API调用工具类
class ApiService {
  private axiosInstance: AxiosInstance;
  private logisticsConfig: { appid: number; outerid: string };
  private cache: Map<string, CacheItem>;
  private cacheTTL: number; // 缓存过期时间（毫秒）


  constructor() {
    this.axiosInstance = axios.create({
      baseURL: '/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    // 物流API配置
    this.logisticsConfig = {
      appid: 346462, // 用户提供的appid
      outerid: '5DAD3AA8098741C0' // 用户提供的outerid
    };
    
    // 初始化缓存
    this.cache = new Map();
    this.cacheTTL = 10 * 60 * 1000; // 默认缓存10分钟

    // 请求拦截器：添加认证token、CSRF令牌和缓存检查
    this.axiosInstance.interceptors.request.use(
      (config) => {
        // 登录、注册和获取CSRF令牌的请求不需要添加Bearer token
        const isAuthRequest = config.url?.startsWith('/auth/login') || 
                            config.url?.startsWith('/auth/register') ||
                            config.url?.startsWith('/auth/csrf-token') ||
                            config.url === '/'; // 获取首页数据的请求也不需要token
        if (!isAuthRequest) {
          const token = useLogisticsStore.getState().auth.token;
          
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          } else {
            console.warn('没有找到token，无法添加Authorization头');
          }
        }

        // 添加CSRF令牌
        const csrfToken = useLogisticsStore.getState().auth.csrfToken;
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken;
        } else {
          console.warn('没有找到CSRF令牌，无法添加X-CSRF-Token头');
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );



    // 响应拦截器：统一处理响应和缓存数据
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        // 从响应头中提取CSRF令牌并存储起来
        const csrfToken = response.headers['x-csrf-token'];
        if (csrfToken) {
          useLogisticsStore.getState().setCsrfToken(csrfToken as string);
        }

        // 确保返回的数据格式一致
        const processedResponse = {
          ...response,
          data: {
            success: response.data?.success !== false,
            data: response.data?.data || response.data,
            message: response.data?.message || '请求成功'
          }
        };
        
        // 记录API请求成功日志
        console.log(`✅ API请求成功`, {
          url: response.config.url,
          method: response.config.method,
          status: response.status,
          statusText: response.statusText,
          message: processedResponse.data.message,
          data: processedResponse.data.data,
          timestamp: new Date().toLocaleTimeString()
        });
        
        // 缓存GET请求的响应
        if (response.config.method === 'get' && processedResponse.data.success) {
          const cacheKey = this.generateCacheKey(response.config);
          this.cache.set(cacheKey, {
            data: processedResponse.data,
            timestamp: Date.now()
          });
        }
        
        return processedResponse;
      },
      (error) => {
        // 处理错误响应，保留更多错误信息
        // 确保message始终是字符串，避免React渲染错误
        let errorMessage = '请求失败';
        if (error.response?.data) {
          if (typeof error.response.data === 'string') {
            errorMessage = error.response.data;
          } else if (error.response.data.message) {
            errorMessage = error.response.data.message;
          } else if (error.response.data.error) {
            errorMessage = error.response.data.error;
          } else {
            try {
              errorMessage = JSON.stringify(error.response.data);
            } catch (e) {
              errorMessage = '请求失败，无法解析错误信息';
            }
          }
        } else {
          errorMessage = error.message || '请求失败';
        }
        
        const errorResponse = {
          success: false,
          message: errorMessage,
          status: error.response?.status,
          originalError: error
        };
        
        // 记录API请求失败日志
        console.log(`❌ API请求失败`, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: errorResponse.message,
          errorData: error.response?.data,
          headers: error.response?.headers,
          timestamp: new Date().toLocaleTimeString()
        });
        
        return Promise.reject(errorResponse);
      }
    );
  }

  // 生成缓存键
  private generateCacheKey(config: AxiosRequestConfig): string {
    const url = config.url || '';
    const params = JSON.stringify(config.params || {});
    return `${url}?${params}`;
  }



  // 检查缓存是否有效
  private isCacheValid(cacheItem: CacheItem): boolean {
    return Date.now() - cacheItem.timestamp < this.cacheTTL;
  }

  // 清除所有缓存
  clearCache(): void {
    this.cache.clear();
  }

  // 根据URL清除缓存
  clearCacheByUrl(url: string): void {
    for (const [key, _] of this.cache.entries()) {
      if (key.startsWith(url)) {
        this.cache.delete(key);
      }
    }
  }

  // 更新缓存过期时间
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  // GET请求（支持缓存）
  async get<T>(url: string, params?: any, options?: { useCache?: boolean }): Promise<ApiResponse<T>> {
    const useCache = options?.useCache !== false;
    
    // 如果启用缓存，尝试从缓存获取
    if (useCache) {
      const cacheKey = this.generateCacheKey({ url, params });
      const cacheItem = this.cache.get(cacheKey);
      
      if (cacheItem && this.isCacheValid(cacheItem)) {
        return cacheItem.data as ApiResponse<T>;
      }
    }
    
    // 缓存未命中或已过期，发起请求
    const response = await this.axiosInstance.get(url, { params });
    return response.data;
  }

  // POST请求（写操作，清除相关缓存）
  async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    // 清除相关缓存
    this.clearCacheByUrl(url.replace(/\/[^/]*$/, '')); // 清除父路径缓存
    const response = await this.axiosInstance.post(url, data);
    return response.data;
  }

  // PUT请求（写操作，清除相关缓存）
  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    // 清除相关缓存
    this.clearCacheByUrl(url.replace(/\/[^/]*$/, '')); // 清除父路径缓存
    const response = await this.axiosInstance.put(url, data);
    return response.data;
  }

  // DELETE请求（写操作，清除相关缓存）
  async delete<T>(url: string): Promise<ApiResponse<T>> {
    // 清除相关缓存
    this.clearCacheByUrl(url.replace(/\/[^/]*$/, '')); // 清除父路径缓存
    const response = await this.axiosInstance.delete(url);
    return response.data;
  }

  // 文件上传
  async upload<T>(url: string, formData: FormData): Promise<ApiResponse<T>> {
    const response = await this.axiosInstance.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  // 发送表单数据请求（用于物流API）
  async postForm<T>(url: string, data: any): Promise<LogisticsApiResponse<T>> {
    // 直接使用axios发送请求，不使用实例的baseURL
    const response = await axios.post(url, new URLSearchParams(data), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });
    return response.data;
  }

  // 物流API：创建批量查询任务
  async createBatchLogisticsTask(params: Omit<CreateBatchTaskParams, 'appid' | 'outerid'>): Promise<LogisticsApiResponse<any>> {
    return this.postForm('http://yun.zhuzhufanli.com/mini/create/', {
      ...params,
      kdgs: getCarrierCode(params.kdgs),
      ...this.logisticsConfig
    });
  }

  // 物流API：获取批量查询结果（通过后端代理）
  async getBatchLogisticsResult(params: Omit<GetBatchResultParams, 'appid' | 'outerid'>): Promise<LogisticsApiResponse<BatchResultData>> {
    // 调用后端代理路由，避免CORS问题
    const response = await this.post<LogisticsApiResponse<BatchResultData>>('/logistics-proxy/select', params);
    return response.data;
  }

  // 物流API：获取单个查询结果（通过后端代理）
  async getSingleLogisticsResult(params: GetSingleResultParams): Promise<LogisticsApiResponse<LogisticsData>> {
    // 调用后端代理路由，避免CORS问题
    const response = await this.post<LogisticsApiResponse<LogisticsData>>('/logistics-proxy/query', {
      ...params,
      kdgs: getCarrierCode(params.kdgs)
    });
    return response.data;
  }

  // 物流API：查询物流信息并同步到数据库
  async queryAndSyncLogistics(params: { kddh: string; kdgs?: string; customer_name?: string; department_key?: string }): Promise<LogisticsApiResponse<{ order: any; logisticsInfo: any }>> {
    const response = await this.post<LogisticsApiResponse<{ order: any; logisticsInfo: any }>>('/logistics-proxy/query-and-sync', params);
    return response.data;
  }
  
  // 更新物流API配置
  updateLogisticsConfig(config: Partial<{ appid: number; outerid: string }>): void {
    this.logisticsConfig = { ...this.logisticsConfig, ...config };
  }

  // 物流API：访问接口账户
  getLogisticsAccountUrl(appid: number, outerid: string): string {
    return `http://yun.zhuzhufanli.com/mini/welcome/?appid=${appid}&outerid=${outerid}`;
  }

  // 用户API：获取所有用户
  async getAllUsers(): Promise<{ success: boolean; data?: any }> {
    return this.get('/users');
  }

  // 用户API：创建用户
  async createUser(userData: any): Promise<{ success: boolean; data?: any }> {
    return this.post('/users', userData);
  }

  // 用户API：更新用户
  async updateUser(userId: number, userData: any): Promise<{ success: boolean; data?: any }> {
    return this.put(`/users/${userId}`, userData);
  }

  // 用户API：删除用户
  async deleteUser(userId: number): Promise<{ success: boolean; data?: any }> {
    return this.delete(`/users/${userId}`);
  }

  // 操作日志API：创建操作日志
  async createOperationLog(logData: any): Promise<{ success: boolean; data?: any }> {
    return this.post('/operation-logs', logData);
  }
}

// 创建API实例
export const apiService = new ApiService();