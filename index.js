'use strict';

module.exports = ShellLoader;

const camelCase = require('lodash/camelCase');
const mapKeys = require('lodash/mapKeys');

function ShellLoader(spec) {
    const argv = [];

    function loader(options) {
        return options;
    }

    return loader;
}
