const multer = require('multer');
const path = require('path');

// 避免解析序列化抛错
const safeParse = (data) => {
   try {
      // 尝试解析数据
      return JSON.parse(data);
   } catch (error) {
      return data
   }
}


//文件上传单例
const multerEvent = {
   uploadDir: 'uploads',  // 上传目录
   upload: null,          // 实例化的multer对象
   //初始化实例化的multer对象
   uploadInit() {
      this.upload = multer({ storage: this.storage() });
   },
   // 存储方式
   storage() {
      //自定义存储          
      return multer.diskStorage({
         //定文件保存的目录 
         destination: function (req, file, cb) {
            cb(null, 'uploads/');
         },
         //指定文件保存的文件名
         filename: function (req, file, cb) {
            console.log(req.body,'存储方式')
            const ext = path.extname(file.originalname);
            //时间戳加上扩展名避免冲突
            const newName = Date.now() + ext;
            // 处理文件名编码问题
            const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
            file.originalname = originalName; // 更新 originalname
            cb(null, newName);
         }
      });
   }
}
//返回体格式化
const toResponse = ({ code, msg, data }) => {
   return {
      code,
      msg,
      data
   }
}
//中间件判断文件类型
const convertParmas = (params) => { 
   const bodykeys = Object.keys(params)
   const filterStrPars = bodykeys.reduce((pre, cur) => {
      if (typeof params[cur] === 'string') {
         params[cur] = safeParse(params[cur])
         pre[cur] = params[cur]
      }
      return pre
   }, {}) 
   return filterStrPars
}
/**
 * @enum {number} codeType
 * @property {number} 200 - 请求成功
 * @property {number} 400 - 请求方式错误
 * @property {number} 404 - 资源未找到
 * @property {number} 500 - 服务器内部错误
 * 
 * 
 * @param   {object} req 请求体  
 * @returns {object} 返回体格式化
 * @returns {boolean} check 是否校验通过
 * @returns {object} data 返回校验数据
 * 
 * 
 * @returns {number} code 返回体状态码
 * @returns {string} msg 返回体提示信息
 * @returns {object} data 返回给客户端体数据
 * @description 请求方式验证
 */
const reqRule = (req) => { 
   const params =  convertParmas(req.body)
   console.log(params, 'reqRule-params')
   if (req.method !== 'POST') {
      return {
         check: false,
         data: toResponse({
            code: 400,
            msg: '请求方式为POST',
            data: {}
         })
      }
   } else if (!req.files) {
      return {
         check: false,
         data: toResponse({
            code: 404,
            msg: '资源未上传',
            data: {}
         })
      }
   }
   //校验通过
   return {
      check: true,
      data: null
   }
}


//注册公共方法域
const common = {
   multerEvent,
   reqRule,
   toResponse
}
module.exports = common;