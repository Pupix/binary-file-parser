/*jslint browser: true, devel: true, node: true, ass: true, nomen: true, unparam: true, indent: 4 */

(function () {
    "use strict";

    var XP = require('expandjs'),
        _  = require('lodash');

    module.exports = new XP.Class('Cache', {

        _cache: {
            enumerable: false,
            configurable: false,
            value: {main: null}
        },

        _parent: {
            value: 'main',
            enumerable: false,
            configurable: false
        },

        _getPath: function (name) {
            return name ? this._parent + '.' + name : this._parent;
        },

        _isValidPath: function (path) {
            return !XP.includes(path, '$');
        },

        set: function (name, value) {
            var self = this,
                path = self._getPath(name);

            if (self._isValidPath(path)) {
                _.set(self._cache, path, value);
                return _.get(self._cache, path);
            }

        },

        get: function (name) {
            var self = this,
                path = self._getPath(name);

            return _.get(self._cache, path);
        },

        remove: function (name) {
            if (name) {
                var self = this,
                    path = self._getPath(name),
                    splices = path.split('.'),
                    toBeRemoved = splices.pop();

                path = splices.join('.');

                delete _.get(self._cache, path)[toBeRemoved];
            }
        },

        /**********************************************************************/

        getAll: function () {
            return this._cache[this._getPath()];
        }
    });

}());