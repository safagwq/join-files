# join-files
join File|Blob|string|Object into a single file, and restore it at any time

```typescript

import { joinFiles , splitFiles , FileItem } from 'join-files'

const input = document.createElement('input')
input.type = 'file'
input.multiple = true
input.onchange = async ()=>{
    const files: FileItem[] = Array.from(input.files)

    files.push({
        name : 'some text',
        data : "123123",
    })
    files.push({
        name : 'some object data',
        data : {
            name : 'safa',
            age : 9999
        },
    })
    console.log( files )

    const result = await joinFiles(files)
    console.log( result )

    const _files = await splitFiles(result)
    console.log( _files )
}
input.click()
```