'use strict';

module.exports = ShellSpec;

const snakeCase = require('lodash/snakeCase');
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

function concatAdjacentFlags(args) {
    return args.reduce((acc, arg, i) => {
        if (arg.type === 'flag') {
            let prev = args[i - 1];
            if (prev && prev.type === 'flag') {
                prev.name += arg.name;
                return acc;
            }
        }
        acc = [ ...acc, arg ];
        return acc;
    }, []);
}

function concatGivenFlags(args, givenFlags) {
    let insertionPoint = 1;
    const [ before, flags, after ] = (args || []).reduce(([ b, f, a ], v, i) => {
        if (v.type === 'flag' && (!Array.isArray(givenFlags) || givenFlags.includes(v.name))) {
            if (!f) {
                insertionPoint = i;
                f = v;
            } else {
                f.name += v.name;
            }
            return [ b, f, a ];
        }
        return i < insertionPoint
            ? [ [ ...b, v ], f, a ]
            : [ b, f, [ ...a, v ] ];
    }, [ [], null, [] ]);
    return flags
        ? [ ...before, flags, ...after ]
        : [ ...before, ...after ];
}

function tokenize(tokens, token, cmdPath, config) {
    if (token == null) throw new Error('invalid arguments');

    if (Array.isArray(token)) return [ ...tokens, ...token.reduce((a, t) => [ ...a, ...tokenize(tokens, t, cmdPath, config) ], tokens) ];

    if (token.command && cmdPath[0] === token.command) {
        if (typeof token.command !== 'string') throw new Error('Invalid Spec: command must be a string');
        const nextToken = token.args || [];
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[token.command] || {};
        return [
            ...tokens,
            {
                name: token.command,
                type: 'value',
                value: token.command
            },
            ...tokenize(tokens, nextToken, nextCmdPath, nextConfig)
        ];
    }

    if (typeof token === 'string') token = { name: token };

    if (config[token.name] == null && token.default) config[token.name] = token.default;

    if (config[token.name] || [ 'variable' ].includes(token.type)) {
        if (token.type == null) token.type = 'option';
        if (typeof token.value === 'string' && token.value.includes('${')) {
            let ctx = mapKeys(config, (v, k) => snakeCase(k));
            token.value = Array.isArray(token.value)
                    ? token.value.map(v => evaluate(`\`${v}\``, ctx))
                    : evaluate(`\`${token.value}\``, ctx);
        } else {
            token.value = config[token.name] != null
                ? Array.isArray(config[token.name])
                    ? config[token.name].map(String)
                    : String(config[token.name])
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
            useValue,
            with:w,
            without:wo
        } = arg;

        if (w) {
            w = Array.isArray(w)
                ? w
                : [ w ];
            if (!tokens.find(v => w.includes(v.name))) {
                throw new Error(`the ${type} \`${name}\` must be accompanied by \`${w.join('\`, `')}\``);
            }
        }

        if (wo) {
            wo = Array.isArray(wo)
                ? wo
                : [ wo ];
            const bad = tokens.find(v => wo.includes(v.name));
            if (bad) {
                throw new Error(`the ${type} \`${name}\` and the ${bad.type} \`${bad.name}\` cannot be used together`);
            }
        }

        let result;

        switch (type) {
            case 'value':
                result = value;
                break;
            case 'values':
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

function mergeConfig(...config) {
    return merge(config.filter(v => v));
}

function getCmdPath(cmd) {
    return Array.isArray(cmd)
        ? cmd
        : cmd.split('.');
}

function ShellSpec(definition) {
    if (definition == null) throw new Error('invalid definition');

    let { spec, label, alias, config:boundConfig = {}, silent } = definition;

    if (spec == null || typeof spec !== 'object') throw new Error('invalid spec');

    let main;
    let concatFlags;

    if (!Array.isArray(spec)) {
        if (!spec.command) throw new Error('invalid spec - missing main command definition');
        spec = populateCollections(spec);
        main = spec.command;
        concatFlags = spec.concatFlags;
    } else {
        main = spec[0];
    }

    function getTokens(cmd, config = {}) {
        cmd = getCmdPath(cmd);
        let tokens = tokenize([], spec, cmd, config);
        if (concatFlags === 'adjacent') tokens = concatAdjacentFlags(tokens);
        if (concatFlags === true || Array.isArray(concatFlags)) tokens = concatGivenFlags(tokens, concatFlags);
        return tokens;
    }

    function getPrompts(cmd, config = {}) {
        cmd = getCmdPath(cmd);
        return prompts([], cmd, spec, { [main]: config }, cmd.join('.'));
    }

    function getArgv(cmd, config = {}) {
        const tokens = getTokens(cmd, { [main]: config });
        const argv = parseArgv(tokens);
        return argv;
    }

    async function awaitArgv(cmd, config = {}) {
        const prompts = getPrompts(cmd, config);
        const answers = await inquirer.prompt(prompts);
        return await getArgv(cmd, mergeConfig(config, answers));
    }

    return { getPrompts, getArgv, awaitArgv };
}
