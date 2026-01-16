import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios from 'axios';
import { apiService } from './api';
import { useLogisticsStore } from './store';

vi.mock('axios');
vi.mock('./store');

const mockAxios = axios as any;
const mockUseLogisticsStore = useLogisticsStore as any;

describe('ApiService', () => {
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogisticsStore.mockReturnValue({
      auth: {
        token: mockToken,
      },
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create axios instance with correct configuration', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: '/api',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should set up logistics API configuration', () => {
      expect(apiService['logisticsConfig']).toEqual({
        appid: 346462,
        outerid: '5DAD3AA8098741C0',
      });
    });
  });

  describe('request interceptor', () => {
    it('should add authorization token to requests when authenticated', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { test: 'data' },
        },
      };

      mockAxios.post.mockResolvedValue(mockResponse as any);

      await apiService.post('/test', { data: 'test' });

      expect(mockAxios.create).toHaveBeenCalled();
      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/test',
        { data: 'test' },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockToken}`,
          }),
        }),
      );
    });

    it('should not add authorization token when not authenticated', async () => {
      mockUseLogisticsStore.mockReturnValue({
        auth: {
          token: null,
        },
      } as any);

      const mockResponse = {
        data: {
          success: true,
          data: { test: 'data' },
        },
      };

      mockAxios.post.mockResolvedValue(mockResponse as any);

      await apiService.post('/test', { data: 'test' });

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/test',
        { data: 'test' },
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('response interceptor', () => {
    it('should format successful responses correctly', async () => {
      const mockApiResponse = {
        data: {
          success: true,
          data: { id: 1, name: 'Test Data' },
          message: 'Operation successful',
        },
      };

      mockAxios.get.mockResolvedValue(mockApiResponse as any);

      const result = await apiService.get('/test');

      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'Test Data' },
        message: 'Operation successful',
      });
    });

    it('should handle responses without explicit success flag', async () => {
      const mockApiResponse = {
        data: {
          id: 1,
          name: 'Test Data',
        },
      };

      mockAxios.get.mockResolvedValue(mockApiResponse as any);

      const result = await apiService.get('/test');

      expect(result).toEqual({
        success: true,
        data: { id: 1, name: 'Test Data' },
        message: '请求成功',
      });
    });

    it('should handle error responses correctly', async () => {
      const mockError = new Error('Network Error');
      mockAxios.get.mockRejectedValue(mockError);

      await expect(apiService.get('/test')).rejects.toThrow('Network Error');
    });

    it('should use error message from response data if available', async () => {
      const mockErrorResponse = {
        response: {
          data: {
            message: 'Invalid request parameters',
          },
        },
      };

      mockAxios.get.mockRejectedValue(mockErrorResponse);

      await expect(apiService.get('/test')).rejects.toThrow('Invalid request parameters');
    });
  });

  describe('HTTP methods', () => {
    it('should make GET requests with correct URL and parameters', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { list: [] },
        },
      };

      mockAxios.get.mockResolvedValue(mockResponse as any);

      await apiService.get('/test', { page: 1, limit: 10 });

      expect(mockAxios.get).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          params: { page: 1, limit: 10 },
        }),
      );
    });

    it('should make POST requests with correct URL and data', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 1 },
        },
      };

      mockAxios.post.mockResolvedValue(mockResponse as any);

      await apiService.post('/test', { name: 'Test' });

      expect(mockAxios.post).toHaveBeenCalledWith('/api/test', { name: 'Test' }, expect.anything());
    });

    it('should make PUT requests with correct URL and data', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: 1, name: 'Updated' },
        },
      };

      mockAxios.put.mockResolvedValue(mockResponse as any);

      await apiService.put('/test/1', { name: 'Updated' });

      expect(mockAxios.put).toHaveBeenCalledWith('/api/test/1', { name: 'Updated' }, expect.anything());
    });

    it('should make DELETE requests with correct URL', async () => {
      const mockResponse = {
        data: {
          success: true,
          message: 'Deleted successfully',
        },
      };

      mockAxios.delete.mockResolvedValue(mockResponse as any);

      await apiService.delete('/test/1');

      expect(mockAxios.delete).toHaveBeenCalledWith('/api/test/1', expect.anything());
    });
  });

  describe('file upload', () => {
    it('should make file upload requests with correct configuration', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['test content']));

      const mockResponse = {
        data: {
          success: true,
          data: { url: 'https://example.com/file.pdf' },
        },
      };

      mockAxios.post.mockResolvedValue(mockResponse as any);

      await apiService.upload('/upload', formData);

      expect(mockAxios.post).toHaveBeenCalledWith(
        '/api/upload',
        formData,
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'multipart/form-data',
          }),
        }),
      );
    });
  });

  describe('logistics API', () => {
    it('should create batch logistics task with correct parameters', async () => {
      const mockResponse = {
        code: 200,
        msg: { taskname: 'test-task' },
      };

      mockAxios.post.mockResolvedValue({ data: mockResponse } as any);

      await apiService.createBatchLogisticsTask({
        zffs: 'online',
        kdgs: 'SF',
        kddh: 'SF1234567890',
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://yun.zhuzhufanli.com/mini/create/',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
    });

    it('should get batch logistics result with correct parameters', async () => {
      const mockResponse = {
        code: 200,
        msg: { jindu: 100, list: [] },
      };

      mockAxios.post.mockResolvedValue({ data: mockResponse } as any);

      await apiService.getBatchLogisticsResult({
        pageno: 1,
        taskname: 'test-task',
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://yun.zhuzhufanli.com/mini/select/',
        expect.any(URLSearchParams),
        expect.anything(),
      );
    });

    it('should get single logistics result with correct parameters', async () => {
      const mockResponse = {
        code: 200,
        msg: { kddh: 'SF1234567890', wuliuzhuangtai: 'delivered' },
      };

      mockAxios.post.mockResolvedValue({ data: mockResponse } as any);

      await apiService.getSingleLogisticsResult({
        kdgs: 'SF',
        kddh: 'SF1234567890',
      });

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://yun.zhuzhufanli.com/mini/query/',
        expect.any(URLSearchParams),
        expect.anything(),
      );
    });

    it('should update logistics API configuration', () => {
      apiService.updateLogisticsConfig({ appid: 123456 });

      expect(apiService['logisticsConfig'].appid).toBe(123456);
      expect(apiService['logisticsConfig'].outerid).toBe('5DAD3AA8098741C0'); 
      // Update outerid as well
      apiService.updateLogisticsConfig({ outerid: 'NEWOUTERID' });
      expect(apiService['logisticsConfig'].outerid).toBe('NEWOUTERID');
    });

    it('should generate logistics account URL correctly', () => {
      const url = apiService.getLogisticsAccountUrl(123456, 'OUTERID123');

      expect(url).toBe('http://yun.zhuzhufanli.com/mini/welcome/?appid=123456&outerid=OUTERID123');
    });
  });
});
