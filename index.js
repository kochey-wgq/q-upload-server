const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const fse = require('fs-extra');
const app = express();
const port = 3000;
const common = require('./utils'); 

// 引入通用方法
const {
   reqRule, //文件类型校验
   toResponse, // 响应体格式化
   getMimeType,   // 获取文件MIME类型
   updateMetadata,   //更新元数据（大文件）
   readdirFiles,      // 读取目录下的资源文件
   createFilesHashes   // 创建/更新文件哈希值
} = common


// 非大文件上传
common.multerEvent.uploadInit(); // 初始化小文件multer对象
~async function() {  // 自执行初始化大文件multer对象
   // 大文件上传
   await common.multerChunksEvent.uploadInit(); 
   
   
}()
  
const {
   UPLOAD_DIR: SAMLL_UPLOAD_DIR,
   upload: smallUpload,
} = common.multerEvent

const {
   storage,
   initDirs,
} = common.multerChunksEvent
 
// 使用 cors 中间件
app.use(cors());
app.use(express.json());

// 目录路径导出
const isExistsSync = (res) => {
   // 小文件的资源path
   const smallFilePath = path.join(__dirname, 'smallFile');
   // 大文件的资源path
   const largeFilePath = path.join(initDirs().COMPLETED_DIR);

   // 检查 smallFile 文件夹是否存在
   if (!fs.existsSync(smallFilePath)) {
      return res.status(404).json(toResponse({
         code: 404,
         msg: '小文件资源目录不存在',
         data: []
      }));
   }
   // 检查 largeFilePath 文件夹是否存在
   if (!fs.existsSync(largeFilePath)) {
      return res.status(404).json(toResponse({
         code: 404,
         msg: '大文件资源目录不存在',
         data: []
      }));
   }
   return { smallFilePath, largeFilePath }
};
 
  
//查询创建有关chunk文件目录
const findChunkDirs = (fileHash) => { 
   // fileHash目录路径
   const fileHashDir = path.resolve(initDirs().TEMP_DIR, fileHash);
   // chunk目录路径
   const chunkDir = path.resolve(fileHashDir, 'chunks');
   if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true })
   }
   return { fileHashDir, chunkDir }
}

//大文件上传分片
app.post('/upload/largeChunk', async (req, res, next) => {
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
         totalChunksSize,
         totalChunksNum,
         fileType,
         chunkIndex
      } = fields

      // 检查必要字段是否存在
      if (!fileHash[0] || !fileName[0] || !totalChunksSize[0]) {
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
            fileSize: totalChunksSize[0],    // 文件总大小(字节)
            fileType: fileType[0],      // 文件MIME类型
            uploadStartTime: new Date().toISOString(), // 上传开始时间
         },

         // 分片信息
         chunksInfo: {
            totalChunksNum: Number(totalChunksNum[0]),  // 总分片数
            chunkSize: `${Number(files.chunk[0].size)}(${(totalChunksSize[0] / (1024 * 1024)).toFixed(2)}MB)`,      // 每个分片大小(字节)
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
      
      const uploadedChunks = await fs.promises.readdir(chunkDir) //查询已上传的分片返回客户端做progress
 
      const successCode = 200;
      res.status(successCode).json(toResponse({ 
         code: successCode,
         msg: '文件上传成功',
         data: {
            chunkSize: Number(files.chunk[0].size), // 每个分片大小(字节)
            index: Number(chunkIndex[0]), // 当前分片索引
            totalChunksSize: Number(totalChunksSize[0]), // 总分大小
            uploadedBytes : +(files.chunk[0].size * uploadedChunks.length), // 已上传的字节数
 
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
app.post('/upload/largeCheck', (req, res, next) => {
   console.log(req.body, 'largeCheck');
   const { fileHash } = req.body;
   // 确定分片目录路径
   const chunkDir = findChunkDirs(fileHash).chunkDir;
   // 读取已上传的分片文件
   const uploadedChunks = fs.readdirSync(chunkDir)
      .map(Number) // 转换为数字
      .sort((a, b) => a - b); // 排序

   const successCode = 200
   res.status(successCode).json(toResponse({
      code: successCode,
      msg: '已上传的分片索引列表',
      data: {
         fileHash,         // 文件哈希值
         uploadedChunks,    // 索引数组  
      }
   }));
});

// merge合并切片
app.post('/upload/largeMerge', (req, res, next) => {
   console.log(req.body, 'largeMerge');
   const { fileHash, fileName } = req.body;
   // fileHash路径
   const fileHashDir = findChunkDirs(fileHash).fileHashDir;
   // 分片目录路径
   const chunkDir = findChunkDirs(fileHash).chunkDir; 
   // 合并完成目录路径
   const computedPath = path.resolve(initDirs().COMPLETED_DIR); 
   // 读取已上传的分片文件
   const uploadedChunks = fs.readdirSync(chunkDir)
      .map(Number) // 转换为数字
      .sort((a, b) => a - b); // 排序
 
   // 合并文件路径
   const filePath = path.join(computedPath, fileName);
   // 创建最终路径的写入流
   const writeStream = fs.createWriteStream(filePath);
   try {
      for (const chunkPath of uploadedChunks) {
         const chunkFilePath = path.resolve(chunkDir, chunkPath.toString());
         const chunkBuffer = fs.readFileSync(chunkFilePath);
         writeStream.write(chunkBuffer);
      }

      writeStream.end();


      // 监听写入完成事件
      writeStream.on('finish', () => {
         console.log(`${fileHashDir}写入完成`);
         //合并成功直接读取文件 
         const filePath = path.join(computedPath, fileName);
         fs.readFile(filePath, (err, data) => {
            if (err) {
               console.error('Error reading file:', err);
               return res.status(500).json(toResponse({
                  code: 500,
                  msg: '读取文件失败',
                  data: err.message
               }));
            }
            // 清理临时文件
            fs.rmSync(fileHashDir, { recursive: true, force: true });
            const stats = fs.statSync(filePath);
            res.status(200).json(toResponse({
               code: 200,
               msg: '合并分片成功',
               data: {
                  originalname: fileName, // 原始文件名
                  mimetype: getMimeType(fileName), // 文件的 MIME 类型
                  suffixType: path.extname(fileName), // 扩展名
                  destination: process.cwd(), // 文件存放的目录
                  fileName: path.basename(fileName, path.extname(fileName)), // 文件名
                  path: filePath, // 文件的完整路径
                  size: stats.size // 文件大小
               }
            }));
         });
      })
   } catch (error) {
      console.error('合并失败:', error);
      res.status(500).json(toResponse({
         code: 500,
         msg: '合并分片失败',
         data: {}
      }));
   }
})


// 大文件秒传
app.get('/upload/largeSecond',async (req,res)=>{
   console.log(req.query, 'largeSecond');
   const { fileHash } = req.query;
   let hashesRes = await createFilesHashes(fileHash) 
   const successCode = 200
   res.status(successCode).json(toResponse({
      code: successCode,
      msg: '已上传的文件',
      data: hashesRes
   }));
})





// 小文件上传
app.post('/upload/small', smallUpload.array('files'), (req, res, next) => {
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
});




// 直接读取本地资源列表
app.get('/upload/resources', async (req, res) => {
   const { smallFilePath, largeFilePath } = isExistsSync(res)
   const [[smallFiles, largeFiles], err] = await readdirFiles({ smallFilePath, largeFilePath })
   // 如果读取过程中出现错误，返回 500 状态码，并返回错误信息
   if (err) {
      console.error('Error reading directory:', err);
      return res.status(500).json(toResponse({
         code: 500,
         msg: '读取文件夹失败',
         data: err.message
      }));
   }
   res.status(200).json(toResponse({
      code: 200,
      msg: '获取资源成功',
      data: {
         smallFiles,
         largeFiles
      }
   }));
   
});


//获取指定图片资源
app.get('/upload/getResource', (req, res) => {
   isExistsSync(res)
   // console.log(req.query)
   const { fileName } = req.query;
   if (!fileName) {
      return res.status(400).json(toResponse({
         code: 400,
         msg: '缺少 fileName 参数',
         data: {}
      }));
   }

   const uploadsPath = path.join(__dirname, 'smallFile');
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
            mimetype: getMimeType(file), // 文件的 MIME 类型
            suffixType: path.extname(file), // 扩展名
            destination: 'smallFile', // 文件存放的目录
            fileName: path.basename(file, path.extname(file)), // 文件名
            path: filePath, // 文件的完整路径
            size: stats.size // 文件大小
         }
      }));
   });
});

//获取指定图片文件
app.get('/upload/:fileName', (req, res) => {
   const { smallFilePath, largeFilePath } = isExistsSync(res)
   console.log(req.params, req.query, '获取指定图片文件')
   const { fileName } = req.params;
   const { type } = req.query;
   if (!fileName) {
      return res.status(400).json(toResponse({
         code: 400,
         msg: '缺少文件名',
         data: {}
      }));
   }

   const uploadsPath = type === 'small' ? smallFilePath : largeFilePath
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