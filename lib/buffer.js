/*jslint regexp:true, browser: true, devel: true, node: true, ass: true, nomen: true, unparam: true, indent: 4 */

(function () {
    "use strict";

    // Vars
    var XP    = require('expandjs'),
        fs    = require('xp-fs'),
        Queue = require('smart-queue');


    /*********************************************************************/

    module.exports = new XP.Class('Stream', {

        /**
         *
         * @param {Object} opt
         *  @param {string} opt.path
         *  @param {string} opt.chunkSize
         */
        initialize: function (opt) {
            var self = this;

            XP.assertArgument(XP.isObject(opt), 1, 'Object');
            XP.assertOption(XP.isString(opt.path), 'opt.path', 'string');
            XP.assertOption(XP.isVoid(opt.chunkSize) || XP.isNumber(opt.chunkSize), 'opt.chunkSize', 'number or void');

            self._path = opt.path;
            self._chunkSize = opt.chunkSize || 64 * 1024;
            self._initialize();

        },

        /**************************************************************/

        _path: {
            value: '',
            configurable: false,
            enumerable: false
        },

        _chunk: {
            value: null,
            configurable: false,
            enumerable: false
        },

        _start: {
            value: null,
            configurable: false,
            enumerable: false
        },

        _end: {
            value: null,
            configurable: false,
            enumerable: false
        },

        _chunkSize: {
            value: null,
            configurable: false,
            enumerable: false
        },

        _queue: {
            value: new Queue(),
            configurable: false,
            enumerable: false
        },

        _reading: {
            value: true,
            configurable: false,
            enumerable: false
        },

        /**************************************************************/

        getPath: function () {
            return this._path;
        },

        /**************************************************************/

        read: {
            promise: true,
            value: function (length, offset, cb) {
                var self = this,
                    chip;

                self._queue.join(function () {
                    self._updateChunk(length, offset, function (err) {
                        if (!err && self._chunk) {
                            chip = new Buffer(self._chunk.slice(offset - self._start, (offset - self._start) + length));
                        }
                        cb(err, chip);
                    });
                });
                self._solveQueue();
            },
            configurable: false,
            enumerable: false
        },

        close: {
            promise: true,
            value: function (cb) {
                var self = this;
                self._queue.join(function () {
                    fs.close(self._fd, cb);
                });
                self._solveQueue();
            },
            configurable: false,
            enumerable: false
        },

        /**************************************************************/

        _initialize: {
            promise: true,
            value: function () {

                //Vars
                var self = this;

                //Checking
                fs.stat(self._path, function (err, stats) {
                    if (err) { throw err; }
                    if (!stats.isFile()) { throw new Error('Specified path is not a file'); }

                    //Loading initial chunk
                    fs.open(self._path, 'r', function (err, fd) {
                        if (err) { throw err; }

                        self._fd  = fd;
                        self._readChunk(0, function (err) {
                            if (err) { throw err; }
                        });
                    });
                });
            },
            configurable: false,
            enumerable: false
        },

        _updateChunk: {
            promise: true,
            value: function (length, offset, cb) {

                //Vars
                var self = this,
                    highMark,
                    lowMark;

                //Defaults
                offset = offset || 0;
                length = length || 0;

                //The new read's offset is lower than the one present in the current chunk
                lowMark = XP.isNumeric(self._start) && (offset < self._start);

                //The new read's length exceeds current chunk's bytes
                highMark = XP.isNumeric(self._end) && (offset + length > self._end);

                if (lowMark || highMark) {
                    return self._readChunk(offset, length, cb);
                }

                //CASE: Reading from the current chunk
                cb();

            },
            configurable: false,
            enumerable: false
        },

        _readChunk: {
            promise: true,
            value: function (offset, length, cb) {

                //Vars
                var self = this;

                //Flag to interrupt new queue calls
                self._reading = true;

                fs.read(self._fd, new Buffer(self._chunkSize), 0, self._chunkSize, offset, function (err, bytes, buffer) {
                    if (err) { cb(err); }

                    //Setting
                    self._chunk = buffer.slice(0, bytes);
                    self._start = offset;
                    self._end = self._start + bytes;

                    //Reset queue flag
                    self._reading = false;

                    //Start resolving queue requests
                    self._solveQueue();
                    cb();
                });

            },
            configurable: false,
            enumerable: false
        },

        _solveQueue: {
            value: function () {
                var self = this,
                    q = self._queue,
                    tmp;

                while (!self._reading && (undefined !== (tmp = q.next()))) {
                    tmp.value();
                }
            },
            configurable: false,
            enumerable: false
        }

    });

}());