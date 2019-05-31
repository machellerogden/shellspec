'use strict';

module.exports = ShellSpec;

const snakeCase = require('lodash/snakeCase');
const mapKeys = require('lodash/mapKeys');
const clone = require('lodash/cloneDeep');
const inquirer = require('inquirer');
const { merge } = require('sugarmerge');
const evaluate = require('./evaluate');
const child_process = require('child_process');

function ShellSpec(definition) {
    if (definition == null) throw new Error('invalid definition');

    let { spec } = definition;

    if (spec == null || typeof spec !== 'object') throw new Error('invalid spec');
    if (!spec.command) throw new Error('invalid spec - missing main command definition');

    spec = populateCollections(spec);

    const main = spec.command;

    function getConfigPaths() {
        return listConfig(spec);
    }

    function getPrompts(config = {}, cmd = '') {
        cmd = getCmdPath(main, cmd);
        return prompts(cmd, clone(spec), { [main]: config }, cmd.join('.'));
    }

    function getArgv(config = {}, cmd = '') {
        const cmdPath = getCmdPath(main, cmd);
        const rawTokens = tokenize(clone(spec), cmdPath, { [main]: config });
        const missingCmd = commandNotFound(cmdPath, rawTokens);
        if (missingCmd) throw new Error(`command \`${missingCmd}\` not found`);
        const validTokens = validate(rawTokens);
        const concattedTokens = concat(validTokens);
        const argv = emit(concattedTokens);
        return argv;
    }

    async function promptedArgv(config = {}, cmd = '') {
        const prompts = getPrompts(config, cmd);
        const answers = (await inquirer.prompt(prompts))[main] || {};
        return await getArgv(merge(config, answers), cmd);
    }

    function spawn(config = {}, cmd = '', spawnOptions = { stdio: 'inherit' }) {
        const [ command, ...args ] = getArgv(config, cmd);
        return child_process.spawn(command, args, spawnOptions);
    }

    async function promptedSpawn(config = {}, cmd = '', spawnOptions = { stdio: 'inherit' }) {
        const [ command, ...args ] = await promptedArgv(config, cmd);
        return child_process.spawn(command, args, spawnOptions);
    }

    return {
        getConfigPaths,
        getPrompts,
        getArgv,
        promptedArgv,
        spawn,
        promptedSpawn
    };
}

function commandNotFound(cmdPath, tokens) {
    const cmds = tokens.reduce((acc, { name, command = false }) => command
        ? [ ...acc, name ]
        : acc, []);
    return cmdPath.find(c => !cmds.includes(c));
}

function concat(tokens) {
    return tokens.reduce((argv, arg, i) => {
        if (argv.length > 0) {
            const prev = argv[argv.length - 1];
            if (arg.concatable && arg.type === 'flag' && !prev.useValue && prev.concatable) {
                prev.name = Array.isArray(prev.name)
                    ? [ ...prev.name, arg.name ]
                    : [ prev.name, arg.name ];
                prev.key += arg.key;
                prev.value = arg.value;
                prev.useValue = arg.useValue;
                return argv;
            }
        }
        return [ ...argv, arg ];
    }, []);
}

function tokenize(token, cmdPath, config) {
    if (token == null) throw new Error('invalid arguments');

    if (Array.isArray(token)) return token.reduce((a, t) => [
        ...a,
        ...tokenize(t, cmdPath, config)
    ], []);

    if (token.command && cmdPath[0] === token.command) {
        if (typeof token.command !== 'string') throw new Error('Invalid Spec: command must be a string');

        const nextToken = token.args || [];
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[token.command] || {};
        const nextTokens = tokenize(nextToken, nextCmdPath, nextConfig);

        return [
            {
                name: token.command,
                type: 'value',
                command: true,
                value: token.command
            },
            ...nextTokens
        ];
    }

    if (typeof token === 'string') token = { name: token };

    if (isMissingRequiredConfig(token, config)) throw new Error(`missing required config for \`${token.name}\``);

    token.key = token.key == null
        ? token.name
        : token.key;

    if (config[token.name] == null && token.default) config[token.name] = token.default;

    if (config[token.name] != null || [ 'variable' ].includes(token.type)) {
        token = standardizeToken(token);
        if (isTemplated(token.value)) {
            // TODO: get rid of casing bullshit... add ctx?
            let ctx = mapKeys(config, (v, k) => snakeCase(k));
            token.value = Array.isArray(token.value)
                    ? token.value.map(v => evaluate(`\`${v}\``, ctx))
                    : evaluate(`\`${token.value}\``, ctx);
        } else {
            token.value = token.value
                || (config[token.name] != null
                    ? config[token.name]
                    : null);
        }
        if (token.type === 'variable') {
            config[token.name] = token.value;
        } else {
            return [ token ];
        }
    }

    return [];
}

function validate(tokens) {
    return tokens.reduce((argv, arg) => {
        let {
            name,
            type = 'option',
            choices,
            value
        } = arg;

        if (arg.with) {
            const result = findInSet(arg.with, tokens, type, name);
            if (result == null) throw new Error(`the ${type} \`${name}\` must be accompanied by \`${Array.isArray(arg.with) ? arg.with.join('\`, `') : arg.with}\``);
        }

        if (arg.withAll) {
            const result = findAllInSet(arg.withAll, tokens, type, name);
            if (!result) throw new Error(`the ${type} \`${name}\` must be accompanied by all of the following: \`${Array.isArray(arg.withAll) ? arg.withAll.join('\`, `') : arg.withAll}\``);
        }

        if (arg.without || arg.aka) {
            const result = findInSet(arg.without || arg.aka, tokens, type, name);
            if (result != null) throw new Error(`the ${type} \`${name}\` and the ${result.type} \`${result.name}\` cannot be used together`);
        }

        if (arg.when) {
            const result = findInSet(arg.when, tokens, type, name);
            if (result == null) return argv;
        }

        if (arg.whenAll) {
            const result = findAllInSet(arg.whenAll, tokens, type, name);
            if (!result) return argv;
        }

        if (arg.unless) {
            const result = findInSet(arg.unless, tokens, type, name);
            if (result != null) return argv;
        }

        if (Array.isArray(choices)) validateValue(choices, value, name, type);

        return [ ...argv, arg ];
    }, []);
}

function emit(tokens) {
    return tokens.reduce((argv, arg) => {

        let {
            key,
            type = 'option',
            value,
            join:delimiter,
            useValue,
            prefix
        } = arg;

        if (delimiter != null) {
            delimiter = typeof delimiter === 'string'
                ? delimiter
                : '=';
        }

        let result;

        switch (type) {
            case 'value':
            case 'values':
                result = value;
                break;
            case 'option':
            case 'flag':
                result = kvJoin(prefix, key, value, type, delimiter, useValue);
                break;
            case '--':
                result = [
                    '--',
                    ...(Array.isArray(value)
                        ? value
                        : [ value ])
                ];
                break;
            default:
                throw new Error(`invalid argument type: ${type}`);
        }
        return (result != null)
            ? [
                ...argv,
                ...(Array.isArray(result) ? result.map(String) : [ String(result) ])
              ]
            : argv;
    }, []);
}

function isMissingRequiredConfig(token, config) {
    return token.required
        && !(config[token.name] != null
            || (token.aka
                ? Array.isArray(token.aka)
                    ? token.aka.some(n => config[n] != null)
                    : config[token.aka] != null
                : false));
}

function prompts(cmdPath, args, config, cmdKey) {
    if (args == null) throw new Error('invalid arguments');

    if (Array.isArray(args)) return args.reduce((a, v) => [
        ...a,
        ...prompts(cmdPath, v, config, cmdKey)
    ], []);

    if (args.command && cmdPath[0] === args.command) {
        if (typeof args.command !== 'string') throw new Error('invalid spec - command must be a string');
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[args.command] || {};
        const nextArgs = args.args || [];

        return [
            ...prompts(nextCmdPath, nextArgs, nextConfig, cmdKey)
        ];
    }

    if (typeof args === 'string') args = { name: args };

    if (isMissingRequiredConfig(args, config)) {
        const name = `${cmdKey}.${args.name}`;
        const message = args.message || name;
        const prompt = {
            name,
            message,
            type: 'input',
            when: answers => isMissingRequiredConfig(merge(config, answers)),
            filter: v => v.split(' ').reduce((a, b, i, c) => {
                if (i < c.length) {
                    if (b.endsWith('\\')) {
                        b = [ b.slice(0, -1),  c[i + 1] ].join(' ');
                        c.splice(i + 1, 1);
                    }
                }
                a = [ ...a, b ];
                return a;
            }, [])
        };
        if (args.choices) {
            prompt.type = 'list';
            prompt.choices = args.choices;
        }
        return [ prompt ];
    }

    return [];
}

function isTemplated (value) {
    return (typeof value === 'string' && value.includes('${'))
        || (Array.isArray(value) && value.reduce((acc, v) => acc || v.includes('${'), false));
}

function standardizeToken(token) {
    if (token.type == null) token.type = 'option';
    if ([ 'option', 'flag' ].includes(token.type)) {
        if (token.type === 'option') token.prefix = '--';
        if (token.type === 'flag') token.prefix = '-';
        if (token.useValue == null) {
            if (token.type == 'option') token.useValue = true;
            if (token.type == 'flag') token.useValue = false;
        }
    }
    return token;
}

const primitives = new Set([ 'string', 'number', 'boolean' ]);
function kvJoin(prefix, key, value, type, delimiter, useValue) {
    key = `${prefix}${key}`;
    if (typeof useValue === 'string') useValue = primitives.has(useValue)
        ? typeof value === useValue
        : value == useValue;
    if (Array.isArray(useValue)) useValue = useValue.reduce((a, uv) =>
        a ||
        primitives.has(uv)
            ? typeof value === uv
            : value == uv,
        false);
    return useValue === false
        ? Array.isArray(value)
            ? value.fill(key)
            : key
        : Array.isArray(value)
            ? delimiter != null
                ? value.reduce((acc, v) => [
                    ...acc,
                    ...[ key, v ].join(delimiter)
                  ], [])
                : value.reduce((acc, v) => [
                    ...acc,
                    key,
                    v
                  ], [])
            : delimiter != null
                ? [ key, value ].join(delimiter)
                : [ key, value ];
}

function getCmdPath(main, cmd) {
    return cmd
        ? [
            main,
            ...(Array.isArray(cmd)
                ? cmd
                : (cmd || '').split('.'))
          ]
        : [ main ];
}

function listConfig(spec, prefix) {
    if (spec == null || typeof spec != 'object') throw new Error('something went wrong');
    return Array.isArray(spec)
        ? spec.reduce((acc, arg) => {
            if (arg.command) {
                acc = [
                    ...acc,
                    ...listConfig(
                        arg.args || [],
                        prefix
                            ? `${prefix}.${arg.command}`
                            : arg.command)
                ];
            } else if (arg.name) {
                acc = [
                    ...acc,
                    prefix
                        ? `${prefix}.${arg.name}`
                        : arg.name
                ];
            }
            return acc;
        }, [])
        : spec.command && [ ...listConfig(spec.args || []) ];
}

function findInSet(testSet, tokens, type, name) {
    testSet = Array.isArray(testSet)
        ? testSet
        : [ testSet ];
    return tokens.find(v => testSet.includes(v.name));
}

function findAllInSet(testSet, tokens, type, name) {
    testSet = Array.isArray(testSet)
        ? testSet
        : [ testSet ];
    let i = 0;
    const names = new Set(tokens.map(({ name }) => name));
    const result = testSet.reduce((a, v) => a && names.has(v), true)
    return result;
}

function validateValue(choices, value, name, type) {
    if (Array.isArray(value)
        ? value.reduce((a, v) => a && !choices.includes(v), true)
        : !choices.includes(value)) {
        throw new Error(`the ${type} \`${name}\` has invalid value of "${value}". Valid values are: ${choices.map(v => `"${v}"`).join(', ')}`);
    }
}

function getByKeyDeep(obj, key, acc = {}) {
    return typeof obj === 'object'
        ? Array.isArray(obj)
            ? {
                ...acc,
                ...obj.reduce((a, v) =>
                    getByKeyDeep(v, key, a),
                    {})
              }
            : {
                ...acc,
                ...Object.entries(obj).reduce((a, [ k, v ]) =>
                    k === key
                        ? { ...a, ...v }
                        : getByKeyDeep(v, key, a),
                    {})
              }
        : acc;
}

function populateCollections(obj) {
    // TODO:
    // Make this actually readable and break it into generic pieces.
    // It probably should just use a simple visitor pattern instead of this
    // nonsense.
    //
    // Sincere apologies to anyone attempting to follow the plot. In leiu of
    // semantic and readable code, here's a description of what's happening:
    //
    // 1. We pull out all "collections" from the spec merging them all into a
    //    single map there is risk of collisions if spec hasn't been properly
    //    crafted to ensure globally unique collection names.
    // 2. We then take a depth first walk through the spec looking for all args
    //    where a type === "collection" and replace each occurence with a spread
    //    value from the collections map with key === name.
    const acc = { ...obj };
    const collections = getByKeyDeep(obj, 'collections');

    function walk(value) {
        return typeof value === 'object'
            ? Array.isArray(value)
                ? value.map(v => walk(v))
                : Object.entries(value).reduce((a, [ k, v ]) => {
                    a[k] = (k === 'args')
                        ? v.reduce((aa, arg) => {
                            if (arg.type === 'collection' && collections[arg.name]) return [
                                ...aa,
                                ...walk(collections[arg.name])
                            ];
                            return [
                                ...aa,
                                walk(arg)
                            ];
                          }, [])
                        : walk(v);
                    return a;
                  }, {})
            : value;
    }

    return walk(acc);
}
