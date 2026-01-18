import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus } from '../../orders/entities/order.entity';

@Injectable()
export class LogisticsUtilService {
  constructor(
    private readonly configService: ConfigService,
  ) {}


  /**
   * 获取物流API基础URL
   */
  getLogisticsApiBaseUrl(): string {
    const baseUrl = this.configService.get<string>('LOGISTICS_API_BASE_URL', 'http://yun.zhuzhufanli.com/mini/');
    // 确保URL以斜杠结尾
    return baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
  }

  /**
   * 获取物流API配置
   */
  getLogisticsConfig(): { appid: number; outerid: string } {
    return {
      appid: parseInt(this.configService.get<string>('LOGISTICS_API_APPID', '346462')),
      outerid: this.configService.get<string>('LOGISTICS_API_OUTERID', '5DAD3AA8098741C0'),
    };
  }

  /**
   * 将第三方物流API的状态映射到系统内部状态
   */
  mapLogisticsStatus(logisticsStatus: string): OrderStatus {
    const normalizedStatus = logisticsStatus.toLowerCase();
    
    if (normalizedStatus.includes('已签收') || normalizedStatus.includes('签收') || normalizedStatus.includes('已代收')) {
      return OrderStatus.DELIVERED;
    } else if (normalizedStatus.includes('已退回') || normalizedStatus.includes('退回')) {
      return OrderStatus.RETURNED;
    } else if (normalizedStatus.includes('运输中') || normalizedStatus.includes('运输') || 
               normalizedStatus.includes('派件') || normalizedStatus.includes('派送') || 
               normalizedStatus.includes('揽收') || normalizedStatus.includes('已揽收') || 
               normalizedStatus.includes('已发出') || normalizedStatus.includes('发出') ||
               normalizedStatus.includes('已到达') || normalizedStatus.includes('到达') ||
               normalizedStatus.includes('正在派送')) {
      return OrderStatus.IN_TRANSIT;
    } else if (normalizedStatus.includes('无物流') || normalizedStatus.includes('待查询')) {
      return OrderStatus.PENDING;
    }
    
    return OrderStatus.IN_TRANSIT;
  }

  /**
   * 根据承运商名称获取承运商代码
   */
  getCarrierCode(carrierName: string): string {
    const carrierMap: Record<string, string> = {
      '圆通速递': 'yuantong',
      '圆通': 'yuantong',
      '京东物流': 'jingdong',
      '京东': 'jingdong',
      '跨越速运': 'kuayuesuyun',
      '跨越': 'kuayuesuyun',
      '申通快递': 'shentong',
      '申通': 'shentong',
      '中通快递': 'zhongtong',
      '中通': 'zhongtong',
      '顺丰速运': 'shunfeng',
      '顺丰': 'shunfeng',
      '韵达快递': 'yunda',
      '韵达': 'yunda',
      '邮政': 'youzhengguonei',
      'EMS': 'ems',
      '极兔': 'jtexpress',
      '极兔速递': 'jtexpress',
      '百世快递': 'baishi',
      '百世': 'baishi',
      '天天快递': 'tiantian',
      '天天': 'tiantian',
      '宅急送': 'zhaijisong',
      '汇通快递': 'huitongkuaidi',
      '全峰快递': 'quanfengkuaidi',
      '国通快递': 'guotongkuaidi',
      '快捷快递': 'kuaijiesudi',
      '优速快递': 'youshuwuliu',
      '速尔快递': 'suoer',
      '德邦物流': 'debangwuliu',
      '德邦': 'debangwuliu',
      '安能物流': 'annengwuliu',
      '安能': 'annengwuliu',
    };

    const code = carrierMap[carrierName];
    
    if (!code) {
      // 如果找不到映射，打印警告并返回空，避免传中文给 API 导致未知错误
      console.warn(`未知的快递公司名称: ${carrierName}，无法映射编码`);
      return '';
    }
    
    return code;
  }

  /**
   * 解析详细物流信息
   */
  parseTrackingDetails(details: string): any[] {
    if (!details || details === '//太长省略//') {
      return [];
    }
    
    try {
      // 尝试解析为JSON
      const parsed = JSON.parse(details);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      // 如果不是JSON格式，尝试按照格式解析
      const nodes: any[] = [];
      
      // 假设格式为：时间|描述
      const lines = details.split('\n');
      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 2) {
          nodes.push({
            time: parts[0].trim(),
            description: parts.slice(1).join('|').trim(),
          });
        }
      }
      
      return nodes;
    }
    
    return [];
  }
}
