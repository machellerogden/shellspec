'use strict';

module.exports = ShellSpec;

const camelCase = require('lodash/camelCase');
const mapKeys = require('lodash/mapKeys');
const cloneDeep = require('lodash/cloneDeep');
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
        return [ ...acc, {
            name,
            type: 'input',
            message: name
        } ];
    }

    return acc;
}

function tokenize(tokens, token, cmdPath, config) {
    if (token == null) throw new Error('invalid arguments');

    if (Array.isArray(token)) return [ ...tokens, ...token.reduce((a, t) => [ ...a, ...tokenize(tokens, t, cmdPath, config) ], tokens) ];

    if (token.command && cmdPath[0] === token.command) {
        if (typeof token.command !== 'string') throw new Error('invalid spec - command must be a string');
        const nextToken = token.args || [];
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[token.command] || {};
        return [ ...tokens, { name: token.command, type: "value", value: token.command }, ...tokenize(tokens, nextToken, nextCmdPath, nextConfig) ];
    }

    if (typeof token === 'string') token = { name: token };

    if (config[token.name] == null && token.default) config[token.name] = token.default;

    if (config[token.name] || [ 'variable' ].includes(token.type)) {
        if (token.type == null) token.type = 'option';
        if (typeof token.value === 'string' && token.value.includes('${')) {
            let ctx = mapKeys(config, (v, k) => camelCase(k));
            token.value = Array.isArray(token.value)
                    ? token.value.map(v => evaluate(`\`${v}\``, ctx))
                    : evaluate(`\`${token.value}\``, ctx);
        } else {
            token.value = config[token.name] != null
                ? String(config[token.name])
                : null;
        }
        if (token.type === 'variable') {
            config[token.name] = token.value;
        } else {
            return [ ...tokens, token ];
        }
    }
    return tokens;
}

function parseArgv(tokens) {
    return tokens.reduce((argv, arg) => {

        let {
            name,
            type = 'option',
            value,
            useEquals,
            useValue
        } = arg;

        let result;

        switch (type) {
            case 'value':
                result = value;
                break;
            case 'option':
                result = `--${name}`;
                if (useValue === false) break;
                result = [ result, value ];
                if (useEquals === true) result = result.join('=');
                break;
            case 'flag':
                result = `-${name}`;
                if (useValue === true) {
                    result = [ result, value ];
                    if (useEquals === true) result.join('=');
                } else if (useEquals === true) {
                    result = [ result, 'true' ].join('=');
                }
                break;
            default:
                throw new Error(`invalid argument type: ${type}`);
        }
        return (result != null)
            ? [ ...argv, ...(Array.isArray(result) ? result : [ result ]) ]
            : argv;
    }, []);
}

function ShellSpec(definition) {
    if (definition == null) throw new Error('invalid definition');

    let { spec, label, alias, config:boundConfig = {}, silent } = definition;

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

    function mergeConfig(config) {
        return Array.isArray(config)
            ? merge(...config.filter(v => v))
            : cloneDeep(config);
    }

    function getCmdPath(name) {
        return Array.isArray(name)
            ? name.slice(1)
            : name.split('.').slice(1);
    }

    function getTokens(config = {}, { name }) {
        name = getCmdPath(name);
        return tokenize([], spec, name, mergeConfig(config));
    }

    function getPrompts(config = {}, { name }) {
        name = getCmdPath(name);
        return prompts([], name, spec, mergeConfig(config), name.join('.'));
    }

    function getArgv(config = {}, meta) {
        const tokens = getTokens(mergeConfig(config), meta);
        const argv = parseArgv(tokens);
        return [ command, ...argv ];
    }

    async function awaitArgv(config = {}, meta) {
        const prompts = getPrompts(config, meta);
        const answers = await inquirer.prompt(prompts);
        return await getArgv([ config, answers ], meta);
    }

    return { getPrompts, getArgv, awaitArgv };
}
