import { Injectable } from '@nestjs/common';
import * as http from 'http';
import * as querystring from 'querystring';

@Injectable()
export class TrackingNumberRecognitionService {
  private readonly apiBaseUrl = 'http://yun.zhuzhufanli.com/mini/'; // 单号识别API基础URL
  private readonly apiConfig = {
    appid: 346462,
    outerid: '5DAD3AA8098741C0',
  };

  /**
   * 识别单个物流单号
   * @param trackingNumber 物流单号
   * @returns 识别结果（包含快递公司代码和名称）
   */
  async recognizeTrackingNumber(trackingNumber: string): Promise<{ carrierCode: string; carrierName: string }> {
    try {
      // 直接使用本地规则识别快递公司（根据API文档，没有单独的识别接口）
      const localRecognition = this.recognizeTrackingNumberLocally(trackingNumber);
      if (localRecognition) {
        console.log('使用本地规则识别成功:', localRecognition);
        return localRecognition;
      }
      
      // 如果本地识别失败，抛出错误
      throw new Error('无法识别该物流单号的快递公司');
    } catch (error) {
      console.error('识别物流单号失败:', error);
      throw error;
    }
  }
  
  /**
   * 使用本地规则识别物流单号（当外部API不可用时使用）
   * @param trackingNumber 物流单号
   * @returns 识别结果或null
   */
  private recognizeTrackingNumberLocally(trackingNumber: string): { carrierCode: string; carrierName: string } | null {
    try {
      if (!trackingNumber || typeof trackingNumber !== 'string') {
        return null;
      }
      
      const normalizedNumber = trackingNumber.trim().toUpperCase();
      
      // 基于单号前缀和长度的本地识别规则
      if (normalizedNumber.startsWith('YT') && normalizedNumber.length >= 12) {
        return { carrierCode: 'yuantong', carrierName: '圆通速递' };
      } else if (normalizedNumber.startsWith('JD') && normalizedNumber.length >= 10) {
        return { carrierCode: 'jingdong', carrierName: '京东物流' };
      } else if (normalizedNumber.startsWith('KY') && normalizedNumber.length >= 12) {
        return { carrierCode: 'kuayuesuyun', carrierName: '跨越速运' };
      } else if (normalizedNumber.startsWith('ST') && normalizedNumber.length >= 12) {
        return { carrierCode: 'shentong', carrierName: '申通快递' };
      } else if (normalizedNumber.startsWith('ZT') && normalizedNumber.length >= 12) {
        return { carrierCode: 'zhongtong', carrierName: '中通快递' };
      } else if (/^[0-9]+$/.test(normalizedNumber) && (normalizedNumber.length === 12 || normalizedNumber.length === 15)) {
        // 纯数字的顺丰单号，长度为12位或15位
        return { carrierCode: 'shunfeng', carrierName: '顺丰速运' };
      } else if (normalizedNumber.startsWith('SF') && /^[0-9A-Z]+$/.test(normalizedNumber)) {
        // 以SF开头的顺丰单号，长度可以是12位(SF+10位数字)或15位(SF+13位数字)
        return { carrierCode: 'shunfeng', carrierName: '顺丰速运' };
      }
      
      return null;
    } catch (error) {
      console.error('本地识别物流单号失败:', error);
      return null;
    }
  }

  /**
   * 批量识别物流单号
   * @param trackingNumbers 物流单号数组
   * @returns 识别结果数组
   */
  async recognizeBatchTrackingNumbers(trackingNumbers: string[]): Promise<Array<{ trackingNumber: string; carrierCode: string; carrierName: string; success: boolean; error?: string }>> {
    const results: Array<{ trackingNumber: string; carrierCode: string; carrierName: string; success: boolean; error?: string }> = [];

    for (const trackingNumber of trackingNumbers) {
      try {
        const recognitionResult = await this.recognizeTrackingNumber(trackingNumber);
        results.push({
          trackingNumber,
          carrierCode: recognitionResult.carrierCode,
          carrierName: recognitionResult.carrierName,
          success: true,
        });
      } catch (error) {
        results.push({
          trackingNumber,
          carrierCode: '',
          carrierName: '',
          success: false,
          error: (error as Error).message,
        });
      }
    }

    return results;
  }

  /**
   * 使用Node.js内置http模块发送POST请求
   */
  private async httpPost(url: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // 解析URL
      const urlParts = new URL(url);

      // 构建请求参数
      const postData = querystring.stringify(data);

      // 请求选项
      const options = {
        hostname: urlParts.hostname,
        port: urlParts.port || 80,
        path: urlParts.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      // 发送请求
      const req = http.request(options, (res) => {
        let responseData = '';

        // 接收响应数据
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        // 响应结束
        res.on('end', () => {
          try {
            // 尝试解析JSON响应
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            // 如果不是JSON格式，直接返回原始数据
            resolve(responseData);
          }
        });
      });

      // 处理请求错误
      req.on('error', (error) => {
        reject(error);
      });

      // 发送请求数据
      req.write(postData);
      req.end();
    });
  }
}
