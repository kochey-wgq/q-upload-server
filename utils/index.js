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
         // 定文件保存的目录 
         destination: function (req, file, cb) {
            cb(null, 'uploads/');
         },
         // 指定文件保存的文件名
         filename: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            // 使用时间戳加上随机数作为唯一标识
            const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newName = `${uniqueId}${ext}`;
            console.log(uniqueId, ext, '存储方式');
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
//反序列化
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

// 获取文件的 MIME 类型
const getMimeType = (fileName) => {
   const ext = path.extname(fileName).toLowerCase();
   const MIME_TYPE_MAP = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.mov': 'video/quicktime',
      '.wmv': 'video/x-ms-wmv',
      '.flv': 'video/x-flv',
      '.webm': 'video/webm',
      '.txt': 'text/plain',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
      '.7z': 'application/x-7z-compressed',
      '.tar': 'application/x-tar',
      '.gz': 'application/gzip',
      '.iso': 'application/x-iso9660-image',
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv',
      '.exe': 'application/octet-stream',
      '.dll': 'application/octet-stream',
      '.bin': 'application/octet-stream',
      '.apk': 'application/vnd.android.package-archive',
      '.dmg': 'application/x-apple-diskimage'
   };
   if (MIME_TYPE_MAP[ext]) {
      return MIME_TYPE_MAP[ext];
   } else {
      return 'application/octet-stream'; // 默认类型
   }
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
   const params = convertParmas(req.body)
   // console.log(params,req.files, 'reqRule-params')
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
   toResponse,
   getMimeType
}
module.exports = common;