export interface JoinedFileMetaData{
    files : FileMetaData[]
    md5 : string
    version : string
}

export interface FileMetaData{
    parse():Promise<FileItem>
    parse(targetType:'string'):Promise<string>
    parse<T>(targetType:'object'):Promise<T>
    parse(targetType:'file'):Promise<File>
    parse(targetType:'blob'):Promise<Blob>
}

let canvas = null as unknown as HTMLCanvasElement
let ctx = null as unknown as CanvasRenderingContext2D


export class FileMetaData{
    name !: string
    size !: number
    start ?: number
    end ?: number
    mimeType ?: string
    joinedFile !: Blob
    JoinedFileMetaData !: JoinedFileMetaData

    type !: 'file'|'blob'|'string'|'object'

    constructor( meta ?: Partial<FileMetaData> ){
        if( meta ){
            Object.assign(this, meta)
        }
    }

    private async parseNative(data:Blob) : Promise<FileItem> {
        const { name , type } = this

        if( type == 'file' ){
            return new File( [data] , name , { type : this.mimeType } )
        }

        if( type == 'blob' ){
            return { name , data }
        }

        const stringData = this.JoinedFileMetaData.version == '' ? uint8ArrayToString( new Uint8Array( await data.arrayBuffer() ) ) : await data.text()

        if( type == 'object'){
            return { name, data : JSON.parse(stringData) }
        }
        return { name : name, data : stringData }    
    }

    private getBlobData(defaultData:FileItem){
        return defaultData instanceof File ? defaultData : (defaultData.data as Blob)
    }
    private getStringData(defaultData:FileItem){
        return (defaultData as {data:string} ).data
    }
    private getObjectData(defaultData:FileItem){
        return (defaultData as {data:Object} ).data
    }

    async parse<T extends any>( targetType ?: 'string'|'object'|'blob'|'file' ) : Promise<FileItem|File|Blob|string|T> {
        const { start , end , name , type , mimeType  } = this

        const data = this.joinedFile.slice(start,end , mimeType || '')
        const result = await this.parseNative(data)

        if( !targetType ){
            return result
        }

        if( targetType == 'string' ){
            if( type == 'string' ){
                return this.getStringData(result)
            }
            if( type == 'object' ){
                return JSON.stringify( this.getObjectData(result) )
            }

            return this.getBlobData(result).text()
        }

        if( targetType == 'object' ){
            if( type == 'string' ){
                return JSON.parse( this.getStringData(result) ) as T
            }
            if( type == 'object' ){
                return this.getObjectData(result) as T
            }

            return JSON.parse( await this.getBlobData(result).text() ) as T
        }

        if( targetType == 'blob' ){
            return data
        }

        if( targetType == 'file' ){
            if( type == 'file' ){
                return result
            }
            if( type == 'blob' ){
                return new File([data] , name)
            }
        }

        return null as unknown as T
    }
}

export type FileItem = File | {
    name:string , 
    data:Blob|string|Object 
}

export async function parseMataData(joinedFile:Blob){
    try {

        const joinedFileMetaLength = new Uint32Array( await joinedFile.slice(0,4).arrayBuffer() )[0]
        const joinedFileMetaBlob = joinedFile.slice(4,4 + joinedFileMetaLength)
        let joinedFileMetaStr = await joinedFileMetaBlob.text()

        if( joinedFileMetaStr[0] == '[' ){
            joinedFileMetaStr = uint8ArrayToString( new Uint8Array( await joinedFileMetaBlob.arrayBuffer() ) )
        }

        const joinedFileMetaData : JoinedFileMetaData = {
            files : [],
            version : '',
            md5 : '',
        }

        const joinedFileMetaDataResult = JSON.parse( joinedFileMetaStr )

        if( Array.isArray( joinedFileMetaDataResult ) ){
            joinedFileMetaData.files = joinedFileMetaDataResult
        }
        else{
            Object.assign(joinedFileMetaData, joinedFileMetaDataResult)
        }

        let start = joinedFileMetaLength + 4
        joinedFileMetaData.files = joinedFileMetaData.files.map((meta)=>{
            meta.start = start
            meta.end = start + meta.size
            meta.joinedFile = joinedFile
            meta.JoinedFileMetaData = joinedFileMetaData

            start = meta.end
            return new FileMetaData(meta)
        })

        return joinedFileMetaData
    }
    catch (error) {
        console.error("parse fail !")
        throw error
    }
}

export async function splitFiles( joinedFile:Blob , filename:string|string[] = '') : Promise<FileItem[]> {
    let targetFilenames : string[]

    if( filename ){
        targetFilenames = Array.isArray(filename) ? filename : [filename]
    }
    try {
        const joinedFileMetaData = await parseMataData(joinedFile)
        const files = await Promise.all(
            joinedFileMetaData.files.map(async (meta)=>{
                if( targetFilenames?.indexOf(meta.name) == -1 ){
                    return null
                }
                return meta.parse()
            })
        )
        return files.filter(fileItem=>fileItem) as FileItem[]
    }
    catch (error) {
        console.error("unpack fail !")
        throw error
    }
}

export async function joinFiles(files: FileItem[] , filename = Date.now() + '.data' ){
    const blobs = [] as Blob[]
    const _files = [] as FileMetaData[]

    for (const item of files) {

        const fileMetaData = new FileMetaData({
            name : item.name,
            type : 'file',
            size : 0,
        })

        let blobData : Blob

        if( item instanceof File){
            fileMetaData.type = 'file'
            fileMetaData.mimeType = item.type
            blobData = item
        }
        else if( item.data instanceof Blob){
            fileMetaData.type = 'blob'
            fileMetaData.mimeType = item.data.type
            blobData = item.data
        }
        else if( typeof item.data == 'string' ){
            fileMetaData.type = 'string'
            blobData = new Blob([ item.data ])
        }
        else{
            fileMetaData.type = 'object'
            blobData = new Blob([ JSON.stringify(item.data) ])
        }

        fileMetaData.size = blobData.size
        blobs.push(blobData)
        _files.push(fileMetaData)
    }

    const joinedFileMetaData = {
        files: _files,
        md5 : '',
        version : '0.1.0'
    }

    const joinedFileMetaBlob = new Blob([ JSON.stringify(joinedFileMetaData) ])
    const joinedFileMetaLength = new Uint8Array( new Uint32Array([ joinedFileMetaBlob.size ]).buffer )

    return new File([ 
        joinedFileMetaLength , 
        joinedFileMetaBlob , 
        ...blobs 
    ] , filename , { type : 'application/octet-stream' })
}



export async function imageFileToFile(url:string|Blob) {
    const image = await toImageSource(url)

    initCanvas(image.width, image.height)
    ctx.drawImage(image, 0, 0)

    const data_rgba = ctx.getImageData(0, 0, image.width, image.height).data
    const data_all = [] as number[]
    for (let i = 0; i < data_rgba.length; i+=4 ) {
        data_all.push(data_rgba[i] , data_rgba[i+1] , data_rgba[i+2])
    }

    const data_all_u8 = new Uint8Array(data_all)
    const meta_u32 = new Uint32Array( data_all_u8.slice(0,8).buffer )
    const data_size = meta_u32[1]
    const filename_size = meta_u32[0]

    const filename = await new Blob( [data_all_u8.slice(8,8+filename_size)] ).text()
    const file = new File([ data_all_u8.slice(8+filename_size , 8+filename_size+data_size) ],filename)

    canvas.width = 0
    canvas.height = 0

    return file
}


export async function fileToImageFile(file:File|Blob , filename = '') {

    // imageSize 6400 x 6400
    if( file.size > 1024 * 200 * 200 ){
        throw new Error("file too big !");
    }

    const _filename = filename || (file instanceof File ? file.name : '')
    const file_u8 = new Uint8Array( await file.arrayBuffer() )
    const file_size = file_u8.length
    const filename_u8 = new Uint8Array( await new Blob([_filename] ).arrayBuffer() )
    const filename_size = filename_u8.length

    const meta_u8 = new Uint8Array(new Uint32Array([ filename_size , file_size ]).buffer)
    const data_all = [ ...meta_u8, ...filename_u8  , ...file_u8 ]
    const data_rgba = [] as number[]

    for (let i = 0; i < data_all.length; i+=3) {
        data_rgba.push( data_all[i] , data_all[i+1]||0 , data_all[i+2]||0 , 255 )
    }

    const imageSize = Math.floor( Math.sqrt(file_u8.length / 3) ) + 1
    const imageData = new ImageData(imageSize , imageSize)
    imageData.data.set(data_rgba)

    initCanvas(imageSize , imageSize)
    ctx.putImageData(imageData, 0, 0 )

    return await new Promise<File>((reject)=>{
        canvas.toBlob((blob)=>{
            const extname = blob!.type == 'image/webp' ? '.webp' : '.png'
            const file = new File([ blob! ] , _filename + extname)
            reject(file)
        },'image/webp',1)
    })
}


function initCanvas(width=0,height=0) {
    if( canvas == null ){
        canvas = document.createElement('canvas')
        ctx = canvas.getContext('2d')!
    }

    canvas.width = width || canvas.width
    canvas.height = height || canvas.height
    ctx.clearRect(0, 0, canvas.width, canvas.height)
}

async function toImageSource(url:string|Blob){
    let _url = url as string

    if( url instanceof Blob ){
        if( 'createImageBitmap' in window){
            return createImageBitmap(url)
        }
        _url = URL.createObjectURL(url)
    }

    return await new Promise<HTMLImageElement>((reject,resolve)=>{
        const _image = new Image()
        _image.referrerPolicy='no-referrer'
        _image.crossOrigin = ''
        _image.src = _url
        _image.onload = ()=>{
            reject(_image)
            if( url != _url ){
                URL.revokeObjectURL(_url)
            }
        }
        _image.onerror = resolve
    })
}

function uint8ArrayToString(data:Uint8Array) {
    const data_u32 = new Uint32Array(data.buffer)
    let str=''
    for (let index = 0; index < data_u32.length; index+=256) {
        str += String.fromCharCode(...data_u32.slice(index,index+256))
    }
    return str
}


// test()
// async function test() {
//     const str = 'asdas asd asd asde 2 ad asd asd asd啥地方'
//     const testFile = new File([ str ],'')
//     const imageFile = await fileToImageFile(testFile)
//     const decodedResult = await imageFileToFile(imageFile)
//     console.log( str == await decodedResult.text() ,  imageFile , testFile , decodedResult )
// }


// test_2()
// async function test_2() {
//     const str = 'asdas asd asd asde 2 ad asd asd asd啥地方'
//     const obj = {
//         aaa : 12323,
//         bbb : str
//     }
//     const file = new File(['console.log("hello")'],'some.js',{ type : 'text/javascript' })

//     const testInput = [
//         { name : 'str' , data : str },
//         { name : 'obj' , data : obj },
//         file,
//     ]
//     console.log( 'testInput' , testInput )

//     const testFile = await joinFiles(testInput , 'test.data')
//     console.log( 'testFile' , testFile )

//     const imageFile = await fileToImageFile(testFile)
//     console.log( 'imageFile' , imageFile )

//     const decodedResult = await imageFileToFile(imageFile)
//     console.log( 'decodedResult' , decodedResult )

//     const splitResult = await splitFiles(decodedResult)
//     console.log( 'splitResult' , splitResult )

//     console.log( await parseMataData(decodedResult) )
// }

