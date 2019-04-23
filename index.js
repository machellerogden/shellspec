'use strict';

module.exports = ShellLoader;

const inquirer = require('inquirer');
const merge = require('deepmerge');

const evaluate = require('./evaluate');

const seq = async p => await p.reduce(async (chain, fn) => Promise.resolve([ ...(await chain), await fn() ]), Promise.resolve([]));

const getCollections = (obj, acc = {}) => typeof obj === 'object'
    ? Array.isArray(obj)
        ? { ...acc, ...obj.reduce((a, v) => getCollections(v, a), {}) }
        : { ...acc, ...Object.entries(obj).reduce((a, [ k, v ]) => (k === 'collections') ? { ...a, ...v } : getCollections(v, a), {}) }
    : acc;

function populateCollections(obj) {
    const acc = { ...obj };
    const collections = getCollections(obj);

    function walk(value) {
        return typeof value === 'object'
            ? Array.isArray(value)
                ? value.map(v => walk(v))
                : Object.entries(value).reduce((a, [ k, v ]) => {
                    a[k] = (k === 'args')
                        ? v.reduce((aa, arg) => {
                              if (arg.type === 'collection' && collections[arg.name]) return [ ...aa, ...walk(collections[arg.name]) ];
                              return [ ...aa, walk(arg) ];
                          }, [])
                        : walk(v);
                    return a;
                }, {})
            : value;
    }

    return walk(acc);
}

function prompts(acc, cmdPath, args, config, cmdKey) {
    if (args == null) throw new Error('invalid arguments');

    if (Array.isArray(args)) return [ ...acc, ...args.reduce((a, v) => [ ...a, ...prompts(acc, cmdPath, v, config, cmdKey) ], acc) ];

    if (args.command && cmdPath[0] === args.command) {
        if (typeof args.command !== 'string') throw new Error('invalid spec - command must be a string');
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[args.command] || {};
        const nextArgs = args.args || [];
        return [ ...acc, ...prompts(acc, nextCmdPath, nextArgs, nextConfig, cmdKey) ];
    }

    if (typeof args === 'string') args = { name: args };

    if (config[args.name] == null && args.required) {
        const name = `${cmdKey}.${args.name}`;
        return [ ...acc, () => inquirer.prompt([{
            name,
            type: 'input',
            message: name
        }]) ];
    }

    return acc;
}

function parseArgs(acc, cmdPath, args, config) {
    if (args == null) throw new Error('invalid arguments');

    if (Array.isArray(args)) return [ ...acc, ...args.reduce((a, v) => [ ...a, ...parseArgs(acc, cmdPath, v, config) ], acc) ];

    if (args.command && cmdPath[0] === args.command) {
        if (typeof args.command !== 'string') throw new Error('invalid spec - command must be a string');
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[args.command] || {};
        const nextArgs = args.args || [];
        return [ ...acc, args.command, ...parseArgs(acc, nextCmdPath, nextArgs, nextConfig) ];
    }

    if (typeof args === 'string') args = { name: args };

    if (args.default) config[args.name] = args.default;

    if (config[args.name] || [ 'variable', 'template' ].includes(args.type)) {
        let { name, type = 'option' } = args;
        const value = config[name] != null
            ? String(config[name])
            : null;
        let result;
        switch (type) {
            case 'value':
                result = value;
                break;
            case 'option':
                result = `--${name}`;
                break;
            case 'flag':
                result = `-${name}`;
                break;
            case 'variable':
                config[name] = value;
                break;
            case 'template':
                result = Array.isArray(args.template)
                    ? args.template.map(v => evaluate(`\`${v}\``, config))
                    : evaluate(`\`${args.template}\``, config);
                break;
            default:
                throw new Error(`invalid argument type: ${type}`);
        }
        if (result != null) return [ ...acc, ...(Array.isArray(result) ? result : [ result ]) ];
    }
    return acc;
}

function ShellLoader(definition) {
    if (definition == null) throw new Error('invalid definition');

    let { spec } = definition;

    if (spec == null || typeof spec !== 'object') throw new Error('invalid spec');

    let command;

    if (!Array.isArray(spec)) {
        if (!spec.command) throw new Error('invalid spec - missing main command definition');
        spec = populateCollections(spec);
        command = spec.command;
        spec = spec.args || [];
    } else {
        command = spec[0];
        spec = spec.slice(1);
    }

    async function loader(cmdPath, config = {}) {
        cmdPath = Array.isArray(cmdPath)
            ? cmdPath.slice(1)
            : cmdPath.split('.').slice(1);
        const answers = await seq(prompts([], cmdPath, spec, config, cmdPath.join('.')));
        const args = parseArgs([], cmdPath, spec, merge(config, ...answers));
        return [ command, ...args ];
    }

    return loader;
}
