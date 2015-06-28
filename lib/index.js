/*jslint regexp:true, browser: true, devel: true, node: true, ass: true, nomen: true, unparam: true, indent: 4 */

(function () {
    "use strict";

    // Vars
    var XP        = require('expandjs'),
        fs        = require('xp-fs'),
        Buffer    = require('./buffer'),
        Cache     = require('./cache');

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

            self._path = opt.path;
            self._chunk = new Buffer({path: self._path});

            self.addShorthandMethods_();

        },

        /**************************************************************/

        _path: {
            value: '',
            configurable: false,
            enumerable: false
        },

        _fileSize: {
            value: null,
            configurable: false,
            enumerable: false
        },

        structs_: {
            value: {},
            configurable: false,
            enumerable: false
        },

        _cache: {
            value: new Cache(),
            configurable: false,
            enumerable: false
        },

        _context: {
            value: '',
            configurable: false,
            enumerable: false
        },

        _chunk: {
            value: {
                buffer: null,
                start: null,
                end: null
            },
            configurable: false,
            enumerable: false
        },

        _endian: {
            value: 'LE',
            configurable: false,
            enumerable: false
        },

        _offset: {
            value: 0,
            configurable: false,
            enumerable: false
        },

        /**************************************************************/

        parse: function (struct, cb) {

            var self = this,
                path = self._path;

            self._setFileStats(path, function (err) {
                if (err) { return cb(err); }

                self._interpret('', struct, cb);
            });

        },

        /**************************************************************/

        getCache: function () {
            return this._cache.getAll();
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
            return this._fileSize;
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
            return this._offset;
        },

        seek: function (offset, cb) {

            XP.assertArgument(XP.isNumber(offset), 1, 'Number');
            XP.assertArgument(XP.isWithin(offset, 0, this.size()), 1, 'within the file bounds [0-' + this.size() + ']');

            var self = this;

            self._offset = offset;
            if (cb) { cb(null, self._offset); }
            return self._offset;
        },

        skip: function (offset) {
            return this.seek(this.tell() + offset);
        },

        /**************************************************************/

        int8: {
            promise: true,
            value: function (length, cb) {
                XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
                var self = this,
                    opt = {kind: 'Int8', step: 1, length: length};

                self._read(opt, cb);
            },
            configurable: false,
            enumerable: false
        },

        uint8: {
            promise: true,
            value: function (length, cb) {
                XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
                var self = this,
                    opt = {kind: 'UInt8', step: 1, length: length};

                self._read(opt, cb);
            },
            configurable: false,
            enumerable: false
        },

        int16: {
            promise: true,
            value: function (length, cb) {
                XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
                var self = this,
                    opt = {kind: 'Int16' + self._endian, step: 2, length: length};

                self._read(opt, cb);
            },
            configurable: false,
            enumerable: false
        },

        uint16: {
            promise: true,
            value: function (length, cb) {
                XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
                var self = this,
                    opt = {kind: 'UInt16' + self._endian, step: 2, length: length};

                self._read(opt, cb);
            },
            configurable: false,
            enumerable: false
        },

        int32: {
            promise: true,
            value: function (length, cb) {
                XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
                var self = this,
                    opt = {kind: 'Int32' + self._endian, step: 4, length: length};

                self._read(opt, cb);
            },
            configurable: false,
            enumerable: false
        },

        uint32: {
            promise: true,
            value: function (length, cb) {
                XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
                var self = this,
                    opt = {kind: 'UInt32' + self._endian, step: 4, length: length};

                self._read(opt, cb);
            },
            configurable: false,
            enumerable: false
        },

        float: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this._read({kind_: 'Float' + this.endian_, step_: 4, length_: length});
        },

        double: function (length) {
            XP.assertArgument(XP.isVoid(length) || XP.isPositive(length), 1, 'Positive number');
            return this._read({kind_: 'Double' + this.endian_, step_: 8, length_: length});
        },

        string: {
            promise: true,
            value: function (length, cb) {
                XP.assertArgument(XP.isPositive(length), 1, 'Positive number');

                var self = this;

                self._chunk.read(length, self._offset, function (err, data) {
                    self._offset += length;
                    cb(err, data.toString('utf8'));
                });
            },
            configurable: false,
            enumerable: false
        },

        string0: function (length, cb) {
            var self = this,
                result = [],
                func = function (callback) {
                    self.uint8(1, function (err, data) {
                        if (err) { callback(err); }
                        if (data === 0) {
                            callback(null, result.join(""));
                        } else {
                            result.push(String.fromCharCode(data));
                            func(callback);
                        }
                    });
                };

            func(cb);
        },

        /**************************************************************/

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

        _read: {
            promise: true,
            value: function (opt, cb) {
                var self = this,
                    result = [];

                XP.iterate(new Array(opt.length), function (next) {
                    self._chunk.read(opt.step, self._offset, function (err, data) {
                        if (!err) {
                            result.push(data['read' + opt.kind](0));
                            self._offset += opt.step;
                        }
                        next(err);
                    });
                }, function (err) {
                    cb(err, result.length === 1 ? result[0] : result);
                });
            },
            configurable : false,
            enumerable: false,
            writable: false
        },

        /**************************************************************/

        try: function (struct) {
            var self = this,
                offset = self._offset,
                result;

            try {
                result = self._interpret(struct);
            } catch (error) {
                result = null;
            }

            self._offset = offset;

            return result;
        },

        read: {
            promise: true,
            value: function (struct, cb) {
                var self = this;

                self._interpret('__read__', struct, function (err) {
                    cb(err, self._cache.get('__read__'));
                    self._cache.remove('__read__');
                });
            },
            configurable: false,
            writable: false
        },

        _interpret: {
            promise: true,
            value: function (ctx, struct, cb) {
                var self = this;

                if (XP.isFunction(struct)) {
                    self._interpretFunction(ctx, struct, cb);
                }

                if (XP.isString(struct)) {
                    self._interpretString(ctx, struct, cb);
                }

                if (XP.isObject(struct)) {
                    self._interpretObject(ctx, struct, cb);
                }
            },
            configurable: false,
            enumerable: true,
            writable: false
        },

        _interpretFunction: {
            promise: true,
            value: function (ctx, struct, cb) {
                var self = this;

                struct.call(self, self.getCache(), function (err, data) {
                    cb(err, self._cache.set(ctx, data));
                });
            },
            configurable: false,
            enumerable: false,
            writable: false
        },

        _interpretString: {
            promise: true,
            value: function (ctx, struct, cb) {
                var self = this,
                    split = self._formatString(struct),
                    name = split.name,
                    length = split.length;

                //Default structs
                if (self[name]) {
                    return self._interpretDefault(ctx, name, length, cb);
                }

                if (self.structs_[name]) {
                    return self._interpretStruct(ctx, name, length, cb);
                }

                //throw new Error('Unknown structure');
                cb(new Error('Unknown structure'));
            },
            configurable: false,
            enumerable: false,
            writable: false
        },

        _interpretObject: {
            promise: true,
            value: function (ctx, struct, cb) {
                var self = this;

                XP.iterate(struct, function (next, value, key) {
                    self._interpret(self._createContext(ctx, key), value, function (err) {
                        next(err);
                    });
                }, function (err) {
                    cb(err, self._cache.get(ctx));
                });
            },
            configurable: false,
            enumerable: false,
            writable: false
        },

        _interpretDefault: {
            promise: true,
            value: function (ctx, name, length, cb) {
                var self = this;

                self[name](length, function (err, data) {
                    cb(err, self._cache.set(ctx, data));
                });
            },
            configurable: false,
            enumerable: false,
            writable: false
        },

        _interpretStruct: {
            promise: true,
            value: function (ctx, name, length, cb) {
                var self = this;

                if (length === 1) {
                    self._interpret(ctx, self.structs_[name], cb);
                } else {
                    XP.iterate(new Array(length), function (next, value, index) {
                        self._interpret(self._createContext(ctx, '', index), self.structs_[name], function (err) {
                            next(err);
                        });
                    }, function (err) {
                        cb(err, self._cache.get(ctx));
                    });
                }
            },
            configurable: false,
            enumerable: false,
            writable: false
        },

        /**************************************************************/
        _formatString: function (string) {
            var self = this,
                structSplit = /^([^(]+)(\((.*)\))?/,
                parts  = string.match(structSplit),
                name   = parts[1],
                length = parts[3] || 1;

            length = XP.isNumeric(length) ? XP.toNumber(length) || 1 : self._cache.get(length);

            return {name: name, length: length};
        },

        /**************************************************************/

        _createContext: function (ctx, key, index) {
            var newCtx,
                parts = [];

            if (ctx) { parts.push(ctx); }
            if (key) { parts.push(key); }

            newCtx = parts.join('.');
            newCtx = !XP.isVoid(index) ? newCtx + '[' + index + ']' : newCtx;

            this._context = newCtx;

            return newCtx;
        },

        /**************************************************************/

        _setFileStats: {
            promise: true,
            value: function (path, cb) {
                var self = this;
                fs.stat(path, function (err, stats) {
                    if (err) { return cb(err, null); }
                    if (!stats.isFile()) { throw new XP.ValidationError('The passed path', 'file'); }

                    self._fileSize = stats.size;

                    cb();
                });
            },
            configurable: false,
            enumerable: false,
            writable: false
        }

    });

}());