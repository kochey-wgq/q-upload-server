const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = 3000;
const common = require('./utils');
common.multerEvent.uploadInit(); // 初始化multer对象

const {
   uploadDir,
   upload
} = common.multerEvent
const {
   reqRule,
   toResponse
} = common
const uploadRouter = (req, res, next) => {
   console.log(req.body, 'req.body');
   console.log(req.files, 'req.files');
   //判断拦截
   if (!reqRule(req).check) {
      return res.status(400).json(reqRule(req).data); // 请求方式验证 
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
// 创建上传目录
!fs.existsSync(uploadDir) && fs.mkdirSync(uploadDir);


app.post('/upload', upload.array('files'), uploadRouter);


// 直接读取本地资源
app.get('/upload/resources', (req, res) => {
   // 定义上传文件的存放路径，使用 __dirname 获取当前文件的路径，然后拼接 'uploads' 文件夹
   const uploadsPath = path.join(__dirname, 'uploads'); 
   // 检查 uploads 文件夹是否存在
   if (!fs.existsSync(uploadsPath)) {
      return res.status(404).json({ code: 404, msg: '资源目录不存在', data: [] });
   }

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
            filename: file, // 文件名
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





app.listen(port, () => {
   console.log(`成功开启端口: ${port}`);
});