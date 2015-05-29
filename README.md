# binary-file-parser (WIP)
A binary file parser with internal buffer and caching system that lets you read virtually infinitely sized files.
Badly written, working, 90% asynchronous and still under development.

## Simple example

```js
var Parser = require('binary-file-parser'),
    opt = {path: 'path/to/file'},
    parser = new Parser(opt);
    
    parser.struct('Header', {
        magic: 'string(4)',
        id: 'short',
        dataOffset: 'uint',
        filesCount: 'uint'
    });
    
    parser.struct('Body', function (cache) {
        var i,
            files = [],
            file = {};
        
        parser.seek(cache.header.dataOffset);
        
        for (i = 0; i < cache.header.structCount; i += 1) {
            file.size = parser.uint();
            file.bytes = parser.uint(file.size);
            files.push(file);
        }
        
        return files;
    });
    
    parser.struct('myFile', {
        header: 'Header',
        data: 'Body'
    });
    
    parser.parse('myFile', function (err, data) {
        console.log(data);
        => {
            "header": {
                "magic": "test",
                "id": 434,
                "dataOffset": 20,
                "filesCount": 3
            },
            "data": [
                {
                    "size": 56
                    "bytes": [23, 87, 21, 46, ...] 
                }
                ...
            ]
        }
    });
```

## Setting methods

### setEndian

## Generic methods

### struct
### parse
### read
### try

## Cache methods

### getCache
### clearCache

## Low level methods

### int8/byte
### uint8/ubyte
### int16/short
### uint16/ushort
### int32/int
### uint32/uint
### float
### double/long
### string
### string0

## Helper methods

### tell
### seek
### skip
### size

## View methods

### stringView
### hexView
### ansiView
    