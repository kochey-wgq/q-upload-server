


# Q-Upload-Server 重点方法逻辑参数说明

## 接口概览

本文档描述了Q-Upload-Server中所有重要接口和工具方法的参数说明，包括小文件上传、大文件分片上传、文件检查、合并等核心功能。

## 客户端项目地址
[该项目所配合的服务端地址](https://github.com/kochey-wgq/q-upload-container)

## 1. 小文件上传接口

### POST /upload/small

**功能描述：** 处理小文件的上传请求，支持多文件同时上传

**请求参数：**
- `files` (FormData): 上传的文件列表
- `accept` (可选): 接受的文件类型规则数组

**响应数据：** [index.js:318-324] 

**相关工具方法：**
- 使用 `reqRule` 进行文件类型校验 [index.js:313-317] 
- 使用 `smallUpload.array('files')` 处理文件上传 [index.js:310] 

## 2. 大文件分片上传接口

### POST /upload/large

**功能描述：** 处理大文件的分片上传，支持断点续传

**请求参数：**
- `fileHash` (string): 文件完整哈希值
- `fileName` (string): 原始文件名
- `totalChunksSize` (string): 文件总大小(字节)
- `totalChunksNum` (string): 总分片数
- `fileType` (string): 文件MIME类型
- `chunkIndex` (string): 当前分片索引
- `chunk` (file): 分片文件数据

**响应数据：** [index.js:174-186] 

**元数据结构：** [index.js:129-153] 

## 3. 大文件分片检查接口

### POST /upload/largeCheck

**功能描述：** 检查指定文件哈希对应的已上传分片数量

**请求参数：**
- `fileHash` (string): 文件哈希值

**响应数据：** [index.js:209-218]

**处理逻辑：** [index.js:202-207] 

## 4. 大文件分片合并接口

### POST /upload/largeMerge

**功能描述：** 合并已上传的所有分片文件为完整文件

**请求参数：**
- `fileHash` (string): 文件哈希值
- `fileName` (string): 目标文件名

**响应数据：** [index.js:266-278] 

**合并逻辑：** [index.js:239-247] 

## 5. 大文件秒传接口

### GET /upload/largeSecond

**功能描述：** 检查文件是否已存在，支持秒传功能

**请求参数：**
- `fileHash` (query string): 文件哈希值

**响应数据：** [index.js:297-302] 

## 6. 获取资源列表接口

### GET /upload/resources

**功能描述：** 获取小文件和大文件目录下的所有资源列表

**响应数据：** [index.js:342-350] 

## 7. 获取指定资源接口

### GET /upload/getResource

**功能描述：** 根据文件名获取指定的小文件资源信息

**请求参数：**
- `fileName` (query string): 文件名（不含扩展名）

**响应数据：** [index.js:390-403] 

## 8. 获取指定文件接口

### GET /upload/:fileName

**功能描述：** 直接下载指定的文件

**请求参数：**
- `fileName` (path param): 文件名（不含扩展名）
- `type` (query string): 文件类型 ("small" 或 "large")

**响应：** 直接返回文件流数据 [index.js:438-441] 

## 核心工具方法

### 1. reqRule - 文件类型校验

**功能描述：** 验证上传文件的类型和请求方式

**参数：**
- `req` (object): Express请求对象

**返回值：** [index.js:382-387] 

**校验规则：** [index.js:290-344] 

### 2. toResponse - 响应体格式化

**功能描述：** 统一格式化API响应体

**参数：** [index.js:192-198] 

### 3. getMimeType - 获取文件MIME类型

**功能描述：** 根据文件扩展名获取MIME类型

**参数：**
- `fileName` (string): 文件名

**MIME类型映射：** [index.js:215-265]  

### 4. updateMetadata - 更新元数据

**功能描述：** 更新大文件上传的元数据信息

**参数：**
- `fileHash` (string): 文件哈希值

**处理逻辑：** [index.js:94-107] 

### 5. readdirFiles - 读取目录文件

**功能描述：** 读取指定目录下的所有文件信息

**参数：** [index.js:144] 

**返回格式：** [index.js:172-182] 

### 6. createFilesHashes - 创建文件哈希值

**功能描述：** 生成已上传文件的哈希值映射表，用于秒传功能

**参数：**
- `fileHash` (string): 待检查的文件哈希值

**处理逻辑：**  [index.js:124-141]

## 配置项

### 小文件上传配置

**存储配置：** [index.js:68-85] 

### 大文件上传配置

**目录初始化：** [index.js:21-29] 

## Notes

1. **文件存储结构：**
   - 小文件存储在 `smallFile/` 目录
   - 大文件临时分片存储在 `largefile/temp/` 目录
   - 大文件合并完成后存储在 `largefile/completed/` 目录

2. **安全性考虑：**
   - 支持文件类型校验，防止恶意文件上传
   - 使用唯一标识符重命名文件，避免文件名冲突
   - 大文件使用哈希值作为唯一标识

3. **性能优化：**
   - 大文件采用分片上传方式，支持断点续传
   - 使用异步处理和Promise.all并行处理
   - 实现秒传功能，避免重复上传相同文件

4. **错误处理：**
   - 所有接口都包含完整的错误处理机制
   - 统一的响应格式便于前端处理
   - 详细的错误信息便于调试
