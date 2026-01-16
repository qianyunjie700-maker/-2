// 直接测试物流API的脚本
import axios from 'axios';

// 物流API配置
const logisticsConfig = {
  appid: 346462,
  outerid: '5DAD3AA8098741C0'
};

// 物流API基础URL
const logisticsApiBaseUrl = 'http://yun.zhuzhufanli.com/mini/';

// 测试获取批量物流结果
async function testBatchLogisticsResult() {
  try {
    console.log('测试获取批量物流结果...');
    
    // 发送请求到物流API
    const response = await axios.post(`${logisticsApiBaseUrl}select/`, {
      ...logisticsConfig,
      taskname: 'latest_orders',
      pageno: 1
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      transformRequest: [(data) => {
        // 转换为表单格式
        return Object.keys(data)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
          .join('&');
      }]
    });
    
    console.log('物流API响应:', JSON.stringify(response.data, null, 2));
    
    if (response.data.code === 0) {
      console.log('物流API返回成功！');
      
      if (response.data.msg?.list) {
        console.log(`共返回 ${response.data.msg.list.length} 条订单数据`);
      } else {
        console.log('物流API返回成功但没有订单数据');
      }
    } else {
      console.log(`物流API返回错误: ${response.data.code} - ${response.data.msg}`);
    }
    
  } catch (error) {
    console.error('调用物流API失败:', error.message);
    if (error.response) {
      console.error('响应状态码:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 执行测试
testBatchLogisticsResult();
