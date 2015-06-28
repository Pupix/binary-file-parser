# binary-file-parser (WIP)
A binary file parser with internal buffer and caching system that lets you read virtually infinitely sized files.
Still under development.

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
    
    parser.struct('myFile', {
        header: 'Header',
    });
    
    parser.parse('myFile', function (err, data) {
        console.log(data);
        => {
            "header": {
                "magic": "test",
                "id": 434,
                "dataOffset": 20,
                "filesCount": 3
            }
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
    