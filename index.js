'use strict';

module.exports = ShellSpec;

const snakeCase = require('lodash/snakeCase');
const mapKeys = require('lodash/mapKeys');
const clone = require('lodash/cloneDeep');
const get = require('lodash/get');
const inquirer = require('inquirer');
const { merge } = require('sugarmerge');
const evaluate = require('./evaluate');
const child_process = require('child_process');

const Joi = require('@hapi/joi');
const {
    alternatives,
    any,
    object,
    string,
    array,
    boolean,
    lazy
} = Joi.bind();

const semverRegExp = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*)?(\+[0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*)?$/;

const conditionalsSchema = alternatives([
    string(),
    array().items(string())
]);

const argsSchema = array().items(alternatives([
    string(),
    object({
        name: string().required(),
        key: string(),
        type: string().valid(
            'option',
            'flag',
            'value',
            'values',
            'variable',
            'collection'),
        value: any(),
        default: any(),
        choices: array().items(string()),
        with: conditionalsSchema,
        withAll: conditionalsSchema,
        without: conditionalsSchema,
        when: conditionalsSchema,
        whenAll: conditionalsSchema,
        unless: conditionalsSchema,
        required: boolean(),
        useValue: boolean(),
        join: alternatives([
            boolean(),
            string()
        ]),
        concatable: boolean(),
        message: string(),
        description: string()
    })
]));

const commandsSchema = object().pattern(
    string(),
    alternatives([
        lazy(() => commandSchema).description('Command schema'),
        object({
            versions: object().pattern(
                string(),
                alternatives([
                    string(),
                    object().pattern(
                        string(),
                        lazy(() => commandSchema).description('Command schema')
                    )
                ])
            )
        })
    ])
);

const commandSchema = object({
    args: argsSchema,
    commands: commandsSchema
});

const definitionSchema = object({
    kind: string().valid('shell'),
    version: string().regex(semverRegExp),
    commands: commandsSchema,
    collections: object().pattern(string(), argsSchema)
});

// .options({ allowUnknown: true });

async function ShellSpec(definition) {
    if (definition == null) throw new Error('invalid definition');

    const def = await definitionSchema.validate(definition);

    const spec = populateCollections(def);

    function getConfigPaths(prefix) {
        return listConfig(spec, prefix);
    }

    function getPrompts(cmd = '', config = {}) {
        const cmdPath = getCmdPath(cmd);
        const mainCmd = selectCmd(cmdPath[0], spec);
        return prompts(cmdPath, mainCmd, config);
    }

    function getArgv(cmd = '', config = {}) {
        const cmdPath = getCmdPath(cmd);
        const mainCmd = selectCmd(cmdPath[0], spec);
        const rawTokens = tokenize(cmdPath, mainCmd, config);
        const validTokens = validate(rawTokens);
        const concattedTokens = concat(validTokens);
        const argv = emit(concattedTokens);
        return argv;
    }

    async function promptedArgv(cmd = '', config = {}) {
        const prompts = getPrompts(cmd, config, cmd);
        const answers = (await inquirer.prompt(prompts))[main] || {};
        return await getArgv(cmd, merge(config, answers));
    }

    function spawn(cmd = '', config = {}, spawnOptions = { stdio: 'inherit' }) {
        const [ command, ...args ] = getArgv(cmd, config);
        return child_process.spawn(command, args, spawnOptions);
    }

    async function promptedSpawn(cmd = '', config = {}, spawnOptions = { stdio: 'inherit' }) {
        const [ command, ...args ] = await promptedArgv(cmd, config);
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

function resolveVersion(versions, ver) {
    if (typeof ver === 'object') return ver;
    const version = versions[ver] || versions['default'];
    if (typeof version == 'string') return resolveVersion(versions, version);
    // TODO: tighten up recursion exit clause
    return version;
}

function selectCmd(mainCmdStr, spec, versionString) {
    if (spec == null || typeof spec !== 'object' || Array.isArray(spec)) throw new Error('invalid spec');

    const mainCmdDef = spec.commands[mainCmdStr];

    let mainCmd;

    if (mainCmdDef == null) throw new Error(`Command \`${mainCmdStr}\` not found.`);

    if (mainCmdDef.versions) {
        mainCmd = resolveVersion(mainCmdDef.versions, versionString);
        if (mainCmd == null) throw new Error(`Version \`${versionString}\` not found.`);
    } else {
        mainCmd = mainCmdDef;
    }

    return { commands: { [mainCmdStr]: clone(mainCmd) } };
}

function tokenize(cmdPath, spec, config) {
    if (spec == null || typeof spec != 'object' || Array.isArray(spec)) throw new Error('invalid spec');

    let result = [
        ...(spec.args || []).reduce((acc, arg) => {
            if (typeof arg === 'string') arg = { name: arg };

            if (isMissingRequiredConfig(arg, config)) throw new Error(`missing required config for \`${arg.name}\``);

            arg.key = arg.key == null
                ? arg.name
                : arg.key;

            if (config[arg.name] == null && arg.default) config[arg.name] = arg.default;

            if (config[arg.name] != null || [ 'variable' ].includes(arg.type)) {
                arg = standardizeToken(arg);
                if (isTemplated(arg.value)) {
                    // TODO:
                    // Find a workaround for case transform below. Introduces
                    // non-determinism via the possibility of name collisions. Easy fix
                    // is to force use a context object when user is writing template
                    // strings. i.e. Use `ctx["arg-name"]` in templates instead of
                    // `argName`. API is a bit uglier, but completely side-steps the
                    // possibility of collisions.
                    //
                    // Alternatively, we could parse template string ahead of evaluation
                    // and apply case change at compile time. Makes a more ideal template
                    // API but doesn't actually solve the essential problem.
                    const ctx = mapKeys(config, (v, k) => snakeCase(k));
                    arg.value = Array.isArray(arg.value)
                            ? arg.value.map(v => evaluate(`\`${v}\``, ctx))
                            : evaluate(`\`${arg.value}\``, ctx);
                } else {
                    arg.value = arg.value
                        || (config[arg.name] != null
                            ? config[arg.name]
                            : null);
                }
                if (arg.type === 'variable') {
                    config[arg.name] = arg.value;
                } else {
                    return [ ...acc, arg ];
                }
            }
            return acc;
        }, [])
    ];

    if (spec.commands && cmdPath.length) {
        if (spec.commands[cmdPath[0]] == null) throw new Error(`Command \`${cmdPath[0]}\` not found.`);
        const nextCmdName = cmdPath[0];
        const nextCmd = spec.commands[nextCmdName];
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[nextCmdName] || {};
        const nextTokens = tokenize(nextCmdPath, nextCmd, nextConfig);
        result = [
            ...result,
            {
                name: nextCmdName,
                type: 'value',
                command: true,
                value: nextCmdName
            },
            ...nextTokens
        ];
    }

    return result;
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

        // TODO: choices should probably support string or array for a more
        // flexible and consistent API. Right now, only arrays are allowed.
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

// TODO: lots of duplicate code between this and the tokenize function. Should probably find a way to dry it up...
function prompts(cmdPath, spec, config, cmdKey) {
    if (spec == null || typeof spec != 'object' || Array.isArray(spec)) throw new Error('invalid spec');

    const currentCmdKey = cmdKey == null
        ? cmdPath[0]
        : cmdKey;

    let result = [
        ...(spec.args || []).reduce((acc, arg) => {
            if (typeof arg === 'string') arg = { name: arg };

            if (isMissingRequiredConfig(arg, config)) {
                const name = `${currentCmdKey}.${arg.name}`;
                const message = arg.message || name;
                const prompt = {
                    name,
                    message,
                    type: 'input',
                    when: answers => isMissingRequiredConfig(arg, merge(config, get(answers, currentCmdKey, {})))

                    // TODO:
                    // Leaving the following in a comment for posterity.
                    // Clean this up once we figure out a better way to handle it.
                    //filter: v => v.split(' ').reduce((a, b, i, c) => {
                        //if (i < c.length) {
                            //if (b.endsWith('\\')) {
                                //b = [ b.slice(0, -1),  c[i + 1] ].join(' ');
                                //c.splice(i + 1, 1);
                            //}
                        //}
                        //a = [ ...a, b ];
                        //return a;
                    //}, [])
                };
                if (arg.choices) {
                    prompt.type = 'list';
                    prompt.choices = arg.choices;
                }
                return [ ...acc, prompt ];
            }
            return acc;
        }, [])
    ];

    if (spec.commands && cmdPath.length) {
        if (spec.commands[cmdPath[0]] == null) throw new Error(`Command \`${cmdPath[0]}\` not found.`);
        const nextCmdName = cmdPath[0];
        const nextCmd = spec.commands[nextCmdName];
        const nextCmdPath = cmdPath.slice(1);
        const nextConfig = config[nextCmdName] || {};
        const nextCmdKey = typeof cmdKey === 'string'
            ? `${cmdKey}.${nextCmdName}`
            : nextCmdName;
        const nextPrompts = prompts(nextCmdPath, nextCmd, nextConfig, nextCmdKey);
        result = [
            ...result,
            ...nextPrompts
        ];
    }

    return result;
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

function getCmdPath(cmd) {
    return cmd
        ? [
            ...(Array.isArray(cmd)
                ? cmd
                : (cmd || '').split('.'))
          ]
        : [];
}

function listConfig(spec, prefix) {
    if (spec == null || typeof spec != 'object') throw new Error('something went wrong');
    const cmds = Object.keys(spec.commands || {}).map(c => selectCmd(c, spec));
    function recur(s) {
        return [
            ...(s.args || []).map(arg =>
                typeof arg === 'string'
                    ? arg
                    : arg.name),
            ...Object.entries(s.commands || {}).reduce((acc, [ k, v ]) => {
                const sub = v.commands || v.args
                    ? recur(v).map(s => `${prefix ? `${prefix}.` : ''}${k}.${s}`)
                    : [];
                return [ ...acc, ...sub ];
            }, [])
        ];
    }
    return cmds.reduce((acc, cmd) => [
        ...acc,
        ...recur(cmd)
    ], []);
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

function populateCollections(spec) {
    // TODO:
    // Make this actually readable and break it into generic pieces.
    // It probably should just use a simple visitor pattern instead of this
    // nonsense.
    //
    // Sincere apologies to anyone attempting to follow the plot. In leiu of
    // semantic and readable code, here's a description of what's happening:
    //
    // 1. We pull out all "collections" from the spec merging them all into a
    //    single map. Note: spec must be properly defined to ensure globally
    //    unique collection names.
    // 2. We then take a depth first walk through the spec looking for all args
    //    where a type === "collection" and replace each occurence with a spread
    //    value from the collections map with key === name.
    const acc = { ...spec };
    const collections = spec.collections;

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
