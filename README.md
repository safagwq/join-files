# join-files
join File|Blob|string|Object into a single file, and restore it at any time
```typescript
import { joinFiles , splitFiles , FileItem } from 'join-files'

const files: FileItem[] = []

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
files.push(
    new File(['some string'] , 'some.txt')
)
console.log( files )

const result = await joinFiles(files)
console.log( result )

const _files = await splitFiles(result)
console.log( _files )
```

convert a File to imageFile , and restore it at any time
```typescript
import { fileToImageFile , imageFileToFile } from 'join-files'

const file = new File(['some string'] , 'some.txt')
console.log(file)

const imageFile = await fileToImageFile(file)
console.log(imageFile)

const _file = await imageFileToFile(imageFile)
console.log(_file)

```

in js
```html
<script type='module'>
    import { joinFiles , splitFiles } from 'https://www.unpkg.com/join-files@0.10.0/index.js'
    // ...
</script>

```