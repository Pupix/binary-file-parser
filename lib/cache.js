/*jslint browser: true, devel: true, node: true, ass: true, nomen: true, unparam: true, indent: 4 */

(function () {
    "use strict";

    var XP   = require('expandjs'),
        leet = require('l33teral');

    module.exports = new XP.Class('Cache', {

        initialize: function () {
            this.cache_ = leet({});
        },

        cache_: {
            enumerable: false,
            value: null
        },

        set: function (name, value) {
            this.cache_.plant(name, value);
        },

        get: function (name, defaultValue) {
            return this.cache_.tap(name, defaultValue);
        },

        /**********************************************************************/

        purge: function () {
            this.cache_ = leet({});
        },

        /**********************************************************************/

        exists: function (name) {
            return this.cache_.probe(name);
        },

        /**********************************************************************/

        getAll: function () {
            return this.cache_.obj;
        }
    });

}());