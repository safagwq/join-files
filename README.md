# merge-files
Merge File|Blob|string|Object into a single file, and restore it at any time

```typescript
const input = document.createElement('input')
input.type = 'file'
input.multiple = true
input.onchange = async ()=>{
    const files = Array.from(input.files)
    console.log( files )

    const result = await joinFiles(files)
    console.log( result )

    const _files = await splitFiles(result)
    console.log( _files )
}
input.click()
```