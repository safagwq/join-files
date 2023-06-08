interface FileMetaData{
    name : string
    size : number
    mimeType ?: string,
    type : 'file'|'blob'|'string'|'object'
}

export type FileItem = File | {name:string , data:Blob|string|Object }

export async function splitFiles( joinedFile:Blob ) : Promise<FileItem[]> {
    const mateDataLength = new Uint32Array( await joinedFile.slice(0,4).arrayBuffer() )
    const metaData = new Uint8Array( await joinedFile.slice(4,4 + mateDataLength[0]).arrayBuffer() )

    try {
        const metaJson = JSON.parse( uint8ArrayToString( metaData ) ) as FileMetaData[]
        let dataStart = 4 + mateDataLength[0]

        const files = await Promise.all(
            metaJson.map(async ({ name , size , type , mimeType })=>{
                const start = dataStart
                const end = dataStart + size
                const data = joinedFile.slice(start,end)
                dataStart = end

                if( type == 'file' ){
                    return new File( [data] , name , mimeType ? { type : mimeType } : {} )
                }

                if( type == 'blob' ){
                    return { name , data }
                }

                const stringData = uint8ArrayToString( new Uint8Array(await data.arrayBuffer() ) )

                if( type == 'object'){
                    return { name, data : JSON.parse(stringData) }
                }

                return { name : name, data : stringData }            
            })
        )
        return files
    }
    catch (error) {
        console.error("unpack fail !")
        throw error
    }
}

export async function joinFiles(files: FileItem[] , filename = Date.now() + '.data' ){
    const datas = [] as Uint8Array[]
    const metaJson = [] as FileMetaData[]

    for (const item of files) {

        const fileMetaData : FileMetaData = {
            name : item.name,
            type : 'file',
            size : 0,
        }

        let file_uint8 : Uint8Array

        if( item instanceof Blob ){
            if( item instanceof File ){
                fileMetaData.type = 'file'
                fileMetaData.mimeType = item.type
            }
            else{
                fileMetaData.type = 'blob'
            }
            
            file_uint8 = new Uint8Array( await item.arrayBuffer() )
        }
        else if( typeof item.data == 'string' ){
            fileMetaData.type = 'string'
            file_uint8 = stringToUint8Array(item.data)
        }
        else{
            fileMetaData.type = 'object'
            file_uint8 = stringToUint8Array(JSON.stringify(item.data))
        }

        fileMetaData.size = file_uint8.length
        datas.push(file_uint8)
        metaJson.push(fileMetaData)
    }

    const metaData = stringToUint8Array(JSON.stringify(metaJson))
    const metaDataLength = new Uint8Array(new Uint32Array([ metaData.length ]).buffer )

    return new File([ metaDataLength , metaData , ...datas ] , filename , { type : 'application/octet-stream' })
}

function uint8ArrayToString(data:Uint8Array) {
    const data_u32 = new Uint32Array(data.buffer)
    let str=''
    for (let index = 0; index < data_u32.length; index+=256) {
        str += String.fromCharCode(...data_u32.slice(index,index+256))
    }
    return str
}

function stringToUint8Array(str:string){
    const data_u32 = new Uint32Array(str.length)    
    for (let i = 0; i < str.length; i++) {
        data_u32[i] = str.charCodeAt(i)
    }
    return new Uint8Array(data_u32.buffer)
}

