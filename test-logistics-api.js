import axios from 'axios';
// 直接在脚本中定义getCarrierCode函数用于测试
const CARRIER_CODES = {
  '顺丰速运': 'sf',
  '圆通快递': 'yt',
  '中通快递': 'zto',
  '申通快递': 'sto',
  '韵达快递': 'yd'
};

const getCarrierCode = (carrierName) => {
  return CARRIER_CODES[carrierName] || carrierName.toLowerCase().replace(/\s/g, '');
};

// 测试物流API请求
async function testLogisticsAPI() {
  console.log('Testing logistics API...');
  
  // 测试快递公司代码转换
  const carrierName = '顺丰速运';
  const carrierCode = getCarrierCode(carrierName);
  console.log(`Carrier name: ${carrierName} -> Carrier code: ${carrierCode}`);
  
  // 测试单个物流查询
  try {
    const response = await axios.post('http://yun.zhuzhufanli.com/mini/query/', new URLSearchParams({
      kdgs: carrierCode,
      kddh: 'SF1234567890123'
    }), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 10000,
    });
    
    console.log('Single logistics query response:', response.data);
  } catch (error) {
    console.error('Single logistics query error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

testLogisticsAPI();
