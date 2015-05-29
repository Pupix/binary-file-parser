/*jslint regexp:true, browser: true, devel: true, node: true, ass: true, nomen: true, unparam: true, indent: 4 */

(function () {
    "use strict";

    // Vars
    var XP    = require('expandjs'),
        fs    = require('xp-fs'),
        Cache = require('./cache');

    /*********************************************************************/

    /** Bitfield function
    var x = function(value, bitindex) {
        return (value & (1 << bitindex)) != 0;
    }
     */

    /*********************************************************************/

    function isAnsi(item) {
        return !(item < 32
        || item === 127
        || item === 129
        || item === 141
        || item === 143
        || item === 144
        || item === 157
        || item > 255);
    }

    /*********************************************************************/

    module.exports = new XP.Class('Parser', {

        /**
         *
         * @param {Object} opt
         *  @param {string} opt.path
         *  @param {number} opt.chunkSize
         */
        initialize: function (opt) {

            XP.assertArgument(XP.isObject(opt), 1, 'Object');
            XP.assertOption(XP.isString(opt.path), 'opt.path', 'String');
            XP.assertOption(XP.isPositive(opt.chunkSize) || XP.isVoid(opt.chunkSize), 'opt.chunkSize', 'void or a positive number');

            var self = this;

            self.path_ = opt.path;
            self.chunk_.size = opt.chunkSize || self.chunk_.size;

            self.addShorthandMethods_();

        },

        /**************************************************************/

        path_ : {
            value: '',
            configurable: false,
            enumerable: false
        },

        context_: {
            value: '',
            configurable: false,
            enumerable: false
        },

        structs_: {
            value: {},
            configurable: false,
            enumerable: false
        },

        cache_: {
            value: new Cache(),
            configurable: false,
            enumerable: false
        },

        fileDescriptor_: {
            value: null,
            configurable: false,
            enumerable: false
        },

        size_: {
            value: null,
            configurable: false,
            enumerable: false
        },

        chunk_: {
            value: {
                size: 16384,
                start: 0,
                end: 0,
                buffer: new Buffer(0)
            },
            configurable: false,
            enumerable: false
        },

        endian_: {
            value: 'LE',
            configurable: false,
            enumerable: false
        },

        offset_: {
            value: 0,
            configurable: false,
            enumerable: false
        },

        /**************************************************************/

        parse: function (struct, cb) {

            var self = this;

            XP.waterfall([ function (next) {
                fs.stat(self.path_, function (err, stats) {
                    if (err) { return next(err); }
                    if (!stats.isFile()) { throw new XP.ValidationError('The passed path', 'file'); }

                    self.fileSize_ = stats.size;

                    if (self.chunk_.size > stats.size) {
                        self.chunk_.size = stats.size;
                    }
                    self.chunk_.buffer = new Buffer(self.chunk_.size);

                    next();
                });
            }, function (next) { //Open file and save the file descriptor
                fs.open(self.path_, 'r', function (err, fd) {
                    if (err) { return next(err); }
                    self.fileDescriptor_ = fd;
                    next();
                });
            }, function (next) {
                // Initialize buffer data and chunk offsets
                fs.read(self.fileDescriptor_, self.chunk_.buffer, 0, self.chunk_.size, self.offset_, function (err) {
                    if (err) { return next(err); }
                    self.chunk_.start = self.offset_;
                    self.chunk_.end = self.offset_ + self.chunk_.size;
                    next();
                });
            }], function (err) {
                if (err) { cb(err); }

                cb(null, self.read(struct));
            });

        },

        /**************************************************************/

        getCache: function () {
            return this.cache_.getAll();
        },

        clearCache: function () {
            return this.cache_.purge();
        },

        /**************************************************************/

        setEndian: function (value) {

            XP.assertArgument(XP.isString(value), 1, 'String');

            value = XP.lowerCase(value);

            if (value === 'little' || value === 'le') {
                this.endian_ = 'LE';
            }
            if (value === 'big' || value === 'be') {
                this.endian_ = 'BE';
            }

            return this.endian_;
        },

        /**************************************************************/

        size: function () {
            return this.fileSize_;
        },

        /**************************************************************/

        stringView: function () {
            var self = this;

            self.seek(0);
            self.updateChunkIfNeeded_(self.size());
            return XP.map(self.chunk_.buffer, function (byte) {
                return String.fromCharCode(byte);
            });
        },

        hexView: function () {
            var self = this,
                pre = '';

            self.seek(0);
            self.updateChunkIfNeeded_(self.size());
            return XP.map(self.chunk_.buffer, function (byte) {
                pre = (byte < 16) ? '0' : '';
                return XP.upperCase(pre + byte.toString(16));
            });
        },

        ansiView: function () {
            var self = this;

            self.seek(0);
            self.updateChunkIfNeeded_(self.size());
            return XP.map(self.chunk_.buffer, function (byte) {
                return isAnsi(byte) ? String.fromCharCode(byte) : '.';
            });
        },

        /**************************************************************/

        tell: function () {
            return this.offset_;
        },

        seek: function (offset) {

            XP.assertArgument(XP.isNumber(offset), 1, 'Number');
            XP.assertArgument(XP.isWithin(offset, 0, this.size()), 1, 'within the file bounds [0-' + this.size() + ']');

            this.offset_ = offset;
            return this.offset_;
        },

        skip: function (offset) {
            return this.seek(this.tell() + offset);
        },

        /**************************************************************/

        int8: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this.read_({kind_: 'Int8', step_: 1, length_: length});
        },

        uint8: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this.read_({kind_: 'UInt8', step_: 1, length_: length});
        },

        int16: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this.read_({kind_: 'Int16' + this.endian_, step_: 2, length_: length});
        },

        uint16: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this.read_({kind_: 'UInt16' + this.endian_, step_: 2, length_: length});
        },

        int32: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this.read_({kind_: 'Int32' + this.endian_, step_: 4, length_: length});
        },

        uint32: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this.read_({kind_: 'UInt32' + this.endian_, step_: 4, length_: length});
        },

        float: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this.read_({kind_: 'Float' + this.endian_, step_: 4, length_: length});
        },

        double: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this.read_({kind_: 'Double' + this.endian_, step_: 8, length_: length});
        },

        string: function (length) {
            XP.assertArgument(XP.isPositive(length), 1, 'Positive number');

            var self = this,
                start = self.tell();

            self.updateChunkIfNeeded_(length);
            self.skip(length);

            return self.chunk_.buffer.toString('utf8', start - self.chunk_.start, start + length);
        },

        string0: function () {
            var result = [],
                byte;

            while ((byte = this.byte()) !== 0) {
                result.push(byte);
            }

            return new Buffer(result).toString('utf8');
        },

        /**************************************************************/

        isStruct: function (name) {
            return XP.includes(XP.keys(this.structs_), name);
        },

        struct: function (name, struct) {
            this.structs_[name] = struct;
        },

        /**************************************************************/

        addShorthandMethods_: function () {
            var self = this;

            self.byte   = self.int8;
            self.ubyte  = self.uint8;
            self.short  = self.int16;
            self.ushort = self.uint16;
            self.int    = self.int32;
            self.uint   = self.uint32;
            self.long   = self.double;
        },

        /**************************************************************/

        read_: {
            value: function (opt) {
                var self = this,
                    chunk = self.chunk_,
                    i,
                    result = [],
                    length = opt.length_ || 1;

                self.updateChunkIfNeeded_(opt.step_ * length);

                for (i = 0; i < length; i += 1) {
                    result.push(chunk.buffer['read' + opt.kind_](self.offset_ - chunk.start));
                    this.skip(opt.step_);
                }

                return length === 1 ? result[0] : result;
            },
            configurable : false,
            enumerable: false,
            writable: false
        },

        /**************************************************************/

        try: function (struct) {
            var self = this,
                offset = self.offset_,
                result;

            try {
                result = self.read(struct);
            } catch (error) {
                result = null;
            }

            self.offset_ = offset;

            return result;
        },

        read: function (struct, index) {
            var self = this;

            if (XP.isFunction(struct)) {
                return self.readFunction_(struct, index);
            }

            if (XP.isString(struct)) {
                return self.readString_(struct);
            }

            if (XP.isObject(struct)) {
                return self.readObject_(struct, index);
            }
        },

        readFunction_: function (struct, index) {
            var self = this,
                context = XP.fileName(self.context_);

            return struct.call(self.cache_.get(context), self.getCache(), index) || XP.merge({}, self.cache_.get(self.context_, null));
        },

        readString_: function (struct) {
            var self = this,
                structSplit = /^([^(]+)(\((.*)\))?/,
                restricted = /^seek|tell|skip|int8|uint8|byte|ubyte|int16|uint16|short|ushort|int32|uint32|int|uint|float|double|long|string|string0/,
                result = [],
                parts,
                name,
                length,
                isFunc,
                i;

            parts  = struct.match(structSplit);
            name   = parts[1];
            length = parts[3] || 1;
            length = XP.isNumeric(length) ? XP.toNumber(length) || 1 : self.cache_.get(length);

            //Default structs
            if (struct.match(restricted)) {
                return self[name](length);
            }

            isFunc = XP.isFunction(self.structs_[name]);

            if (isFunc) {
                self.updateContext_(name);
            }

            for (i = 0; i < length; i += 1) {
                result.push(
                    self.read(self.structs_[name], i) || XP.merge({}, self.cache_.get(self.context_, null))
                );
            }

            if (isFunc) {
                self.updateContext_();
            }

            return length === 1 ? result[0] : result;
        },

        readObject_: function (struct) {
            var self = this,
                output = {},
                read;

            XP.forOwn(struct, function (value, key) {

                self.updateContext_(key);

                read = self.read(value);

                if (read !== undefined) {
                    if (key.match(/^\$/)) {
                        if (XP.isObject(read)) {
                            output = XP.merge(output, read);
                            self.cache_.set(XP.fileName(self.context_), XP.merge(self.cache_.get(XP.fileName(self.context_)), read));
                        } else {
                            output[key.replace('$', '')] = read;
                            self.cache_.set(self.context_.replace('$', ''), read);
                        }
                    } else {
                        output[key] = read;
                        self.cache_.set(self.context_, read);
                    }
                }

                self.updateContext_();
            });

            return output;
        },

        /**************************************************************/

        updateContext_: function (key) {
            var self = this;

            if (key) {
                if (self.context_) {
                    self.context_ += '.' + key;
                } else {
                    self.context_ = key;
                }
            } else {
                if (self.context_.match(/.*\./)) {
                    self.context_ = self.context_.match(/.*\./)[0].slice(0, -1);
                } else {
                    self.context_ = '';
                }
            }

        },

        /**************************************************************/

        updateChunkIfNeeded_: function (nextReadSize) {
            var self = this;

            if (self.offset_ < self.chunk_.start || self.offset_ + nextReadSize > self.chunk_.end) {
                self.updateChunk_(nextReadSize);
            }
        },

        updateChunk_: function (bytesNeeded) {

            var self = this,
                unusedBytes,
                bytesToSave,
                oldBuffer,
                maxPossibleRead,
                nextReadSize,
                nextReadStart,
                nextReadEnd;

            bytesNeeded = bytesNeeded || 0;

            //Checking if the needed bytes will go out of bound
            if (bytesNeeded + self.offset_ > self.size()) {
                throw new Error('Out of file bounds [0-' + self.size() + ']');
            }

            //In case there has been a backwards `seek` and went outside of the current chunk
            if (self.chunk_.start > self.offset_) {
                nextReadSize = self.chunk_.size;
                nextReadStart = self.offset_;
                nextReadEnd = nextReadStart + nextReadSize;
                bytesToSave = 0;
                self.chunk_.buffer = new Buffer(nextReadSize);
            } else {
                //How many bytes are unused from the current buffer
                unusedBytes = self.chunk_.end - self.offset_;

                //How many bytes to save from the current buffer
                bytesToSave = (unusedBytes > 0) ? unusedBytes : 0;

                //The number of bytes needed to be read from the file
                bytesNeeded = bytesNeeded - bytesToSave;

                //The saved bytes from the old buffer
                oldBuffer = new Buffer(XP.takeRight(self.chunk_.buffer, bytesToSave));

                //Max number of bytes left to read from the file
                maxPossibleRead = self.size() - self.offset_;

                //The size in bytes of the next read to satify either the required bytes or the chunk size
                nextReadSize = (bytesNeeded > self.chunk_.size) ? bytesNeeded : self.chunk_.size;
                nextReadSize = (nextReadSize > maxPossibleRead) ? maxPossibleRead : nextReadSize;

                //The start position in the file of the new buffer chunk
                nextReadStart = self.offset_ + bytesToSave;

                //The end position in the file of the new buffer chunk
                nextReadEnd = nextReadSize + self.offset_ + bytesToSave;

                //Concat old buffer with the new one
                self.chunk_.buffer = Buffer.concat([oldBuffer, new Buffer(nextReadSize)]);
            }

            //Read file and write the new buffer chunk
            fs.readSync(self.fileDescriptor_, self.chunk_.buffer, bytesToSave, nextReadSize, nextReadStart);

            //Set the chunk's position relative to the file
            self.chunk_.start = nextReadStart - bytesToSave;
            self.chunk_.end   = nextReadEnd;

        }

    });

}());
