const express = require('express')
const fs = require('fs')
const bodyParser = require('body-parser')
const multer = require('multer')
const multiparty = require('multiparty')
const { consumers } = require('stream')
const { UV_FS_O_FILEMAP } = require('constants')

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

const UploadMiddle = multer({
  dest: './upload/'
})

app.all("*", (request, response, next) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers","content-type,Authorization")
  if (request.method == 'OPTIONS')  response.send(200);  
  else  next();
})
// app.post('/upload',UploadMiddle.any(),(req,res) => {
  // console.log(req.files)
  // for(let i in req.files){
  //   let newName = './upload/' + req.files[i].originalname
  //   fs.rename(req.files[i].path, newName, (err) => {
  //     // if(err) res.send("上传失败")
  //     // else    res.send('上传成功')
  //     if(i == req.files.length - 1) res.send('123')
  //   })
  // }
  // res.send('123')
// })

app.get('/already',(req,res) => {
  const {HASH} = req.query
  let nameList = []
  if(fs.existsSync( './upload/'+HASH))
    nameList = fs.readdirSync('./upload/'+HASH).sort((a,b) => a-b)
  res.send(nameList)
})

app.post('/upload',async (req,res) => {
  let form = new multiparty.Form({uploadDir: './upload'})
  form.parse(req,async (err,fields,files) => {
    //fields是前端formData.append()的非FormData类型数据
    //files是文件的路径等信息,
    const index = fields.name[0].match(/(?<=_)\d+(?=.)/)['0']
    const dir = fields.name[0].match(/.+(?=_\d+)/)['0']
    //创建存放切片的目录
    if(!fs.existsSync( './upload/'+dir))  fs.mkdirSync('./upload/'+dir,err => {})
    //将切片移动到创建的目录
    //用常规的移动文件也可以，但有大小限制，推荐用流写入
    const buffer = fs.readFileSync(files.chunk[0].path)
    let ws = fs.createWriteStream(`./upload/${dir}/${index}`)
    ws.write(buffer)
    ws.close()
    //删除留在外面的切片文件
    fs.unlinkSync(files.chunk[0].path,err => {})
    res.send(index)
  })
})

const Buffer = require('buffer').Buffer
app.post('/merge',(req,res) => {
  const {HASH,fileName,chunkSum} = req.body
  //得到所有切片的名字
  const nameList = fs.readdirSync('./upload/'+HASH)
  if(nameList.length < chunkSum){
    res.send('上传失败')
    return
  }
  //排序切片名
  nameList.sort((a,b) => a-b)
  //合并切片需要buffer格式的切片的数组，和所有切片的总字节
  let Byte = 0, bufferList = []
  for(let name of nameList){
    let buffer = fs.readFileSync(`./upload/${HASH}/${name}`)
    bufferList.push(buffer)
    Byte += buffer.length
  }
  let mergeBuffer = Buffer.concat(bufferList,Byte)
  //以流的形式写入文件，没有大小限制
  let ws = fs.createWriteStream('./upload/'+fileName)
  ws.write(mergeBuffer)
  ws.close()
  //合并完成，删除存放切片的临时文件夹
  for(n of nameList)  fs.unlinkSync(`./upload/${HASH}/${n}`)
  fs.rmdirSync(`./upload/${HASH}`)
  res.send('上传成功')
})

app.listen(8000,()=>[
  console.log('服务已启动') 
])
