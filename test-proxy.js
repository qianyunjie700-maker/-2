import * as http from 'http';

// 定义发送POST请求的函数
function sendPostRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: responseData
        });
      });
    });
    
    req.on('error', (e) => {
      reject(new Error(`请求错误: ${e.message}`));
    });
    
    req.write(postData);
    req.end();
  });
}

// 测试流程：先创建一个任务，然后查询任务结果
async function testLogisticsProxy() {
  try {
    console.log('=== 创建任务测试 ===');
    
    // 创建任务的参数
    const createTaskData = JSON.stringify({
      zffs: '0',
      kdgs: 'sf',
      kddh: 'SF1234567890'
    });
    
    // 创建任务的请求选项
    const createTaskOptions = {
      hostname: 'localhost',
      port: 3002,
      path: '/api/logistics-proxy/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(createTaskData)
      }
    };
    
    // 发送创建任务请求
    const createResponse = await sendPostRequest(createTaskOptions, createTaskData);
    console.log(`创建任务状态码: ${createResponse.statusCode}`);
    console.log(`创建任务响应数据: ${createResponse.data}`);
    
    // 解析创建任务的响应数据
    const createResult = JSON.parse(createResponse.data);
    if (createResult.code === 0 && createResult.msg) {
      const taskname = createResult.msg;
      console.log(`创建任务成功，任务名称: ${taskname}`);
      
      // 查询任务结果
      console.log('\n=== 查询任务结果测试 ===');
      
      // 查询任务结果的参数
      const queryTaskData = JSON.stringify({
        taskname: taskname,
        pageno: 1
      });
      
      // 查询任务结果的请求选项
      const queryTaskOptions = {
        hostname: 'localhost',
        port: 3002,
        path: '/api/logistics-proxy/select',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(queryTaskData)
        }
      };
      
      // 发送查询任务结果请求
      const queryResponse = await sendPostRequest(queryTaskOptions, queryTaskData);
      console.log(`查询任务结果状态码: ${queryResponse.statusCode}`);
      console.log(`查询任务结果响应数据: ${queryResponse.data}`);
    } else {
      console.log('创建任务失败');
    }
  } catch (error) {
    console.error(`测试失败: ${error.message}`);
  }
}

// 执行测试
testLogisticsProxy();
