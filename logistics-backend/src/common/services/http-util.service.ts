import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import axiosRetry from 'axios-retry';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs'; // 导入qs库，用于将对象转换为application/x-www-form-urlencoded格式
import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface HttpPostOptions {
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

@Injectable()
export class HttpUtilService {
  constructor(private httpService: HttpService) {
    // 配置全局重试策略
    axiosRetry(this.httpService.axiosRef, {
      retries: 3,
      retryDelay: (retryCount) => {
        // 指数退避策略
        return Math.pow(2, retryCount) * 1000;
      },
      retryCondition: (error) => {
        // 仅对网络错误或服务器错误进行重试
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response ? error.response.status >= 500 : false);
      },
    });
  }

  async httpPost(url: string, data: any, options?: HttpPostOptions): Promise<any> {
    try {
      const { timeout = 10000, retryCount, retryDelay, headers } = options || {};

      // 创建一个新的axios实例
      const axiosInstance = axios.create();

      // 配置重试策略
      axiosRetry(axiosInstance, {
        retries: retryCount ?? 3,
        retryDelay: retryDelay ? () => retryDelay : (count) => Math.pow(2, count) * 1000,
        retryCondition: (error) => {
          return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response ? error.response.status >= 500 : false);
        },
      });

      // 将数据转换为application/x-www-form-urlencoded格式
      const encodedData = qs.stringify(data);

      // 直接调用axios实例的post方法
      const response: AxiosResponse = await axiosInstance.post(url, encodedData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          ...headers,
        },
        timeout,
      });

      return response.data;
    } catch (error: any) {
      if (error.code === 'ECONNABORTED') {
        throw new InternalServerErrorException('请求超时，请稍后重试');
      } else if (error.response) {
        // 服务器返回了错误响应
        throw new InternalServerErrorException(
          `第三方服务错误: ${error.response.status} ${error.response.statusText}`,
        );
      } else if (error.request) {
        // 请求已发送但没有收到响应
        throw new InternalServerErrorException('无法连接到第三方服务，请稍后重试');
      } else {
        // 请求配置错误
        throw new InternalServerErrorException(`请求错误: ${error.message}`);
      }
    }
  }
}
