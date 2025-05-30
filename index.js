const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const fse = require('fs-extra');
const app = express();
const port = 3000;
const common = require('./utils');
// 非大文件上传
// common.multerEvent.uploadInit(); // 初始化multer对象
// const {
//    UPLOAD_DIR,
//    upload
// } = common.multerEvent
// 大文件上传
common.multerChunksEvent.uploadInit(); // 初始化大文件multer对象
const {
   storage,
   initDirs,
} = common.multerChunksEvent

// 引入通用方法
const {
   reqRule,
   toResponse,
   getMimeType,
   updateMetadata
} = common

//文件上传路由
const uploadRouter = (req, res, next) => {
   console.log(req.body, 'req.body');
   console.log(req.files, 'req.files');
   const { check, data } = reqRule(req)
   //判断拦截
   if (!check) {
      return res.status(400).json(data); // 请求方式验证 
   }
   const successCode = 200
   res.status(successCode).json(toResponse({
      code: successCode,
      msg: '文件上传成功',
      data: req.files
   }));
}
// 使用 cors 中间件
app.use(cors());
app.use(express.json());
// // 创建上传目录
// if(!fs.existsSync(UPLOAD_DIR)){
//    fs.mkdirSync(UPLOAD_DIR)

// } 

app.post('/upload', async (req, res, next) => {
   try {
      console.log(req.body, 'req.body');
      console.log(req.chunk, 'req.chunk');

      // 使用await替代.then()使代码更清晰
      const { fields, files, err } = await storage(req);

      console.log(fields, files, err, 'fields, files,err');
      // multiparty解析错误
      if (err) {
         console.error('解析错误:', err);
         res.status(500).json(toResponse({
            code: 500,
            msg: '解析错误',
            data: err
         }));
         return
      }
      // 优化字段提取
      const {
         fileHash,
         fileName,
         totalChunks,
         totalChunksNum,
         fileType,
         chunkIndex
      } = fields

      // 检查必要字段是否存在
      if (!fileHash[0] || !fileName[0] || !totalChunks[0]) {
         res.status(500).json(toResponse({
            code: 500,
            msg: '文件上传失败，必要字段缺失',
            data: {}
         }));
      }

      const chunkDir = path.resolve(initDirs().TEMP_DIR, fileHash[0], 'chunks');


      if (!fs.existsSync(chunkDir)) fs.mkdirSync(chunkDir, { recursive: true });



      // 元数据创建
      const metadata = {
         // 文件基本信息
         fileInfo: {
            fileName: fileName[0],       // 原始文件名
            fileHash: fileHash[0],      // 文件完整哈希值
            fileSize: totalChunks[0],    // 文件总大小(字节)
            fileType: fileType[0],      // 文件MIME类型
            uploadStartTime: new Date().toISOString(), // 上传开始时间
         },

         // 分片信息
         chunksInfo: {
            totalChunksNum: Number(totalChunksNum[0]),  // 总分片数
            chunkSize: `${Number(files.chunk[0].size)}(${(totalChunks[0] / (1024 * 1024)).toFixed(2)}MB)`,      // 每个分片大小(字节)
            uploadedChunks: [],                   // 已上传的分片索引数组
            lastUpdated: new Date().toISOString() // 最后更新时间
         },

         // 系统信息
         systemInfo: {
            storagePath: path.resolve(initDirs().TEMP_DIR, fileHash[0]),     // 文件存储路径
            version: '1.0'              // 元数据版本
         }
      };

      await fs.promises.writeFile(
         path.resolve(initDirs().TEMP_DIR, fileHash[0], 'metadata.json'),
         JSON.stringify(metadata, null, 2)
      );
      // 并行处理文件移动
      await Promise.all(
         files.chunk.map(async file =>
            await fse.move(
               file.path,
               path.join(chunkDir, chunkIndex[0]),
               {
                  overwrite: true // 可选，是否覆盖已存在文件
               }
            )
         )
      ); 
      
      const successCode = 200;
      res.status(successCode).json(toResponse({
         code: successCode,
         msg: '文件上传成功',
         data: {
            chunkSize: `${Number(files.chunk[0].size)}(${(totalChunks[0] / (1024 * 1024)).toFixed(2)}MB)`, // 每个分片大小(字节)
            index: chunkIndex[0], // 当前分片索引
         }
      }));
      // 更新元数据
      updateMetadata(fileHash[0])
   } catch (error) {
      console.error('上传处理错误:', error);
      res.status(500).json(toResponse({
         code: 500,
         msg: '文件上传失败',
         data: error
      }));
   }
});

// check大文件切片已上传的数量
app.post('/check', (req, res, next) => {
   console.log(req.body, 'req.body');
   const { fileHash } = req.body;
   // 确定分片目录路径
   const chunkDir = path.resolve(initDirs().TEMP_DIR, fileHash, 'chunks');
   console.log(fs.existsSync(chunkDir), 'chunkDir是否存在');
   // 如果分片目录不存在，则创建
   if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true })
   }
   // 读取已上传的分片文件
   const uploadedChunks = fs.readdirSync(chunkDir)
      .filter(name => name !== 'metadata.json') // 排除元数据文件
      .map(Number) // 转换为数字
      .sort((a, b) => a - b); // 排序
   const successCode = 200
   res.status(successCode).json(toResponse({
      code: successCode,
      msg: '文件检测',
      data: uploadedChunks
   }));
});


// app.post('/upload', upload.array('files'), uploadRouter);

const isExistsSync = () => {
   // 定义上传文件的存放路径，使用 __dirname 获取当前文件的路径，然后拼接 'uploads' 文件夹
   const uploadsPath = path.join(__dirname, 'uploads');
   // 检查 uploads 文件夹是否存在
   if (!fs.existsSync(uploadsPath)) {
      return { code: 404, msg: '资源目录不存在', data: [] };
   }
   return { uploadsPath }
};

// 直接读取本地资源列表
app.get('/upload/resources', (req, res) => {
   const { uploadsPath } = isExistsSync()

   // 使用 fs 模块的 readdir 方法读取 uploadsPath 目录下的所有文件
   fs.readdir(uploadsPath, (err, files) => {
      // 如果读取过程中出现错误，返回 500 状态码，并返回错误信息
      if (err) {
         console.error('Error reading directory:', err);
         return res.status(500).json({ code: 500, msg: '读取文件夹失败', data: err.message });
      }


      // 如果没有错误，将读取到的文件列表映射为资源对象数组
      const resources = files.map(file => {
         // 获取每个文件的完整路径
         const filePath = path.join(uploadsPath, file);
         // 使用 fs.statSync 方法获取文件的元数据信息（同步操作）
         const stats = fs.statSync(filePath);

         // 返回一个对象，包含文件的相关信息
         return {
            fieldname: 'files', // 表单字段名称
            originalname: file, // 原始文件名
            mimetype: path.extname(file), // 文件的 MIME 类型（扩展名）
            destination: 'uploads', // 文件存放的目录
            fileName: path.basename(file, path.extname(file)), // 文件名（不包含扩展名）
            path: filePath, // 文件的完整路径
            size: stats.size // 文件大小
         };
      });

      // 返回 200 状态码，并返回成功信息和资源数组
      res.status(200).json(toResponse({
         code: 200,
         msg: '获取资源成功',
         data: resources
      }));
   });
});


//获取指定图片资源
app.get('/upload/getResource', (req, res) => {
   isExistsSync()
   // console.log(req.query)
   const { fileName } = req.query;
   if (!fileName) {
      return res.status(400).json(toResponse({
         code: 400,
         msg: '缺少 fileName 参数',
         data: {}
      }));
   }

   const uploadsPath = path.join(__dirname, 'uploads');
   const files = fs.readdirSync(uploadsPath);
   const file = files.find(f => path.basename(f, path.extname(f)) === fileName);
   const filePath = path.join(uploadsPath, file);
   if (!fs.existsSync(filePath)) {
      return res.status(404).json(toResponse({
         code: 404,
         msg: '文件不存在',
         data: {}
      }));
   }

   fs.readFile(filePath, (err, data) => {
      if (err) {
         console.error('Error reading file:', err);
         return res.status(500).json(toResponse({
            code: 500,
            msg: '读取文件失败',
            data: err.message
         }));
      }

      const stats = fs.statSync(filePath);
      res.status(200).json(toResponse({
         code: 200,
         msg: '获取文件成功',
         data: {
            fieldname: 'files', // 表单字段名称
            originalname: fileName, // 原始文件名
            mimetype: path.extname(file), // 文件的 MIME 类型（扩展名）
            destination: 'uploads', // 文件存放的目录
            fileName: path.basename(file, path.extname(file)), // 文件名
            path: filePath, // 文件的完整路径
            size: stats.size // 文件大小
         }
      }));
   });
});

//获取指定图片文件
app.get('/upload/:fileName', (req, res) => {
   isExistsSync()
   console.log(req.params)
   const { fileName } = req.params;
   if (!fileName) {
      return res.status(400).json(toResponse({
         code: 400,
         msg: '缺少文件名',
         data: {}
      }));
   }

   const uploadsPath = path.join(__dirname, 'uploads');
   const files = fs.readdirSync(uploadsPath);
   const file = files.find(f => path.basename(f, path.extname(f)) === fileName);
   const filePath = path.join(uploadsPath, file);
   if (!fs.existsSync(filePath)) {
      return res.status(404).json(toResponse({
         code: 404,
         msg: '文件不存在',
         data: {}
      }));
   }
   fs.readFile(filePath, (err, data) => {
      if (err) {
         console.error('Error reading file:', err);
         return res.status(500).send('文件读取失败');
      }

      res.setHeader('Content-Type', getMimeType(file));
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(data);
   });
});




app.listen(port, () => {
   console.log(`成功开启端口: ${port}`);
});