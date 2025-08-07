const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const multiparty = require('multiparty');
const CryptoJS = require('crypto');
// 避免解析序列化抛错
const safeParse = (data) => {
   try {
      // 尝试解析数据
      return JSON.parse(data);
   } catch (error) {
      return data
   }
}


//大文件上传 
const multerChunksEvent = {

   initDirs() {
      const UPLOAD_DIR = path.resolve(process.cwd(), 'largefile')         // 上传目录 
      const TEMP_DIR = path.resolve(UPLOAD_DIR, 'temp')            // chunk临时目录
      const COMPLETED_DIR = path.resolve(UPLOAD_DIR, 'completed')  // 完成目录
      return {
         UPLOAD_DIR,
         TEMP_DIR,
         COMPLETED_DIR
      }
   },
   //初始化实例化的multer对象
   async uploadInit() {
      this.createDirs() // 创建目录 
   },
   createDirs() {
      Object.values(this.initDirs()).forEach(dir => {
         !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true })
      })
   },
   // 存储方式
   storage(req) {
      return new Promise((resolve, reject) => {
         const form = new multiparty.Form();
         form.parse(req, (err, fields, files) => {
            resolve({ fields, files })
            reject({ err })
         })
      })
   }
}



//小文件上传
const multerEvent = {
   UPLOAD_DIR: 'smallFile',  // 上传目录 
   upload: null,          // 实例化的multer对象
   //初始化实例化的multer对象
   uploadInit() {
      // 创建目录
      if (!fs.existsSync(this.UPLOAD_DIR)) {
         fs.mkdirSync(this.UPLOAD_DIR)

      }
      this.upload = multer({ storage: this.storage() });
   },
   // 存储方式
   storage() {
      //自定义存储          
      return multer.diskStorage({
         // 定文件保存的目录 
         destination: function (req, file, cb) {
            cb(null, 'smallFile/');
         },
         // 指定文件保存的文件名
         filename: function (req, file, cb) {
            const ext = path.extname(file.originalname);
            // 使用时间戳加上随机数作为唯一标识
            const uniqueId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const newName = `${uniqueId}${ext}`;
            console.log(req.files, req.body, '存储方式');
            cb(null, newName);
         }
      });
   }
}

// 更新元数据
const updateMetadata = async (fileHash) => {
   const metadataDir = path.resolve(multerChunksEvent.initDirs().TEMP_DIR, fileHash);
   const metadataPath = path.join(metadataDir, 'metadata.json');

   // 1. 读取现有元数据
   const rawData = await fs.promises.readFile(metadataPath, { encoding: 'utf8' });
   const metadata = safeParse(JSON.parse(rawData));

   // 2. 只更新可变部分 
   const chunkDir = path.resolve(multerChunksEvent.initDirs().TEMP_DIR, fileHash, 'chunks');
   metadata.chunksInfo.uploadedChunks = fs.readdirSync(chunkDir)
      .map(Number) // 转换为数字 
      .sort((a, b) => a - b); // 排序
   metadata.chunksInfo.lastUpdated = new Date().toISOString();

   // 3. 保存更新后的元数据
   await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

   return metadata;
}


// 获取文件的哈希值
const getFileHash = (filePath) => {
   const fileBuffer = fs.readFileSync(filePath);
   const hash = CryptoJS.createHash('sha256');
   hash.update(fileBuffer);
   return hash.digest('hex');
}

// 生成所有文件的hashes json
const createFilesHashes = async (fileHash) => {
   const completeDir = multerChunksEvent.initDirs().COMPLETED_DIR;
   const filesDir = fs.readdirSync(completeDir);

   const hashes = filesDir.reduce((acc, file) => { 
      if(file.includes('hashes.json')) return acc; // 跳过 hashes.json 文件
      const filePath = path.join(completeDir, file);
      const fileHash = getFileHash(filePath); // 获取文件的哈希值
      acc[fileHash] = filePath; // 将文件名和哈希值存入对象
      return acc;
   }, {});
   console.log(hashes, '生成的文件哈希值');

   const hashesPath = path.join(completeDir, `hashes.json`);
   fs.writeFileSync(hashesPath, JSON.stringify(hashes, null, 2), { encoding: 'utf8' });
 

   // 1. 读取现有已上传的文件数据
   const rawData = fs.readFileSync(hashesPath, { encoding: 'utf8' });
   const hashesData = safeParse(JSON.parse(rawData));  
   return Object.keys(hashesData).some(t => t.includes(fileHash)) ? 1 : 0; // 判断是否已上传
}

// 读取小文件和大文件数据
const readdirFiles = ({ smallFilePath, largeFilePath }) => {
   return new Promise(async res => {
      let err = null
      try {
         let [fileNames1, fileNames2] = await Promise.all([
            fs.promises.readdir(smallFilePath),
            fs.promises.readdir(largeFilePath)
         ])
         let files = [
            {
               filePath: smallFilePath,
               fileNames: fileNames1
            },
            {
               filePath: largeFilePath,
               fileNames: fileNames2
            }
         ].map(file => {


            // 如果没有错误，将读取到的文件列表映射为资源对象数组
            const resources = file.fileNames.map(t => {
               // 获取每个文件的完整路径
               const filePath = path.join(file.filePath, t);
               // 使用 fs.statSync 方法获取文件的元数据信息（同步操作）
               const stats = fs.statSync(filePath);

               // 返回一个对象，包含文件的相关信息
               return {
                  fieldname: 'files', // 表单字段名称 
                  originalname: t, // 原始文件名
                  mimetype: getMimeType(t), // 文件的 MIME 类型
                  suffixType: path.extname(t), // 扩展名
                  destination: 'smallFile', // 文件存放的目录
                  fileName: path.basename(t, path.extname(t)), // 文件名（不包含扩展名）
                  path: filePath, // 文件的完整路径
                  size: stats.size // 文件大小
               };
            });
            return resources
         })
         res([files, err])
      } catch (err) {
         res([null, err])
      }
   })
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
 * @property {number} 406 - 资源类型不正确
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
   //资源校验
   const validateFiles = (files, acceptRules) => {
      console.log(acceptRules, 'acceptRules')
      const invalidFiles = [];
      let isValid = true;
      if (!acceptRules || acceptRules.length === 0) {
         return { isValid, invalidFiles };
      }

      // 确保files总是数组形式
      const fileList = Array.isArray(files) ? files : [files];


      for (const file of fileList) {
         const extension = path.extname(file.originalname).toLowerCase()
         const mimeType = file.mimetype.toLowerCase();
         let fileValid = false;

         for (const rule of acceptRules) {
            // 允许所有类型的规则
            if(acceptRules === '*') {
               fileValid = true;
               break;
            }
            // 处理通配符情况
            if (rule.endsWith('/*')) {
               const category = rule.split('/*')[0];
               if (mimeType.startsWith(category)) {
                  fileValid = true;
                  break;
               }
            }
            // 处理具体 MIME 类型
            else if (rule.includes('/')) {
               if (mimeType === rule.toLowerCase()) {
                  fileValid = true;
                  break;
               }
            }
            // 处理文件扩展名
            else {
               const ruleMime = mime.lookup(rule);
               if (ruleMime && (mimeType === ruleMime || extension === rule.toLowerCase())) {
                  fileValid = true;
                  break;
               }
            }
         }
         // 不符合的资源都返回客户端
         if (!fileValid) {
            isValid = false;
            invalidFiles.push(file);
         }
      }

      return {
         isValid,
         invalidFiles
      };
   };

   const { isValid, invalidFiles } = validateFiles(req.files, params.accept)
   console.log(isValid, invalidFiles, 'checkFilesExt')
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
   } else if (!isValid) {  // 资源校验不通过
      // 删除无效文件
      req.files.forEach(file => {
         if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
         }
      });
      return {
         check: false,
         data: toResponse({
            code: 406,
            msg: '所上传的资源类型有误',
            data: invalidFiles      // 返回无效文件列表
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
   multerChunksEvent,
   reqRule,
   toResponse,
   getMimeType,
   updateMetadata,
   readdirFiles,
   safeParse,
   getFileHash,
   createFilesHashes
}
module.exports = common;