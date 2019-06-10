# ShellSpec

> Shell command specification and JavaScript reference implementation

### Contents

* [Versions](#versions)
* [Specification](#specification)
* [Reference Implementation](#reference-implementation)

### Versions

* **Latest**: `1.0.0`
* **Stable**: `1.0.0`

# Specification

The intention of ShellSpec is that any arbitrary shell command can be specified
by implementing the `Definition` interface below.

> #### A Note on Descriptor Syntax
> TypeScript is used below to describe the specification. TypeScript is prefered
> over something like EBNF in hopes that it will be more approachable. Please
> note ShellSpec has nothing to do with TypeScript. Even the reference
> implementation (contained in this repo) does not use TypeScript. It appears
> here simply to act as a descriptor syntax.

```ts
/**
 * Top-level of spec file must implement `Definition`.
 */
interface Definition {
    /**
     * Indicates to consumers that this is a ShellSpec specification.
     */
    kind: 'shell';

    /**
     * Version of the ShellSpec specification being implemented.
     */
    version: string;


    /**
     * Definition of entry-point command.
     */
    spec: Spec
}

interface BaseSpec {

    /**
     * Name of main entry-point command.
     */
    main: string;

    /**
     * Map of named collections which are reusable throughout args and
     * subcommands via Args of `type` = 'collection' where Arg `name` = {key of
     * `collections`}. All Args of `type` = 'collection' are populated at
     * compile time.
     */
    collections?: {
        [key: string]: Args
    };
}

interface VersionedSpec extends BaseSpec {
    versions: {
        [key: string]: string | Command
    }

    /**
     * Note: When using versioned spec, `args` and `command` are not allowed.
     */
    args?: undefined;
    commands?: undefined;
}

interface UnversionedSpec extends BaseSpec {
    /**
     * Collection of argument definitions.
     */
    args: Args;

    /**
     * Map of sub-commands where key is a string representing the command
     * argument and the value implements `Command`.
     */
    commands?: {
        [key: string]: Command
    }

    /**
     * Note: When using unversioned spec, `versions` is not allowed.
     */
    versions?: undefined;
}

type Spec = VersionedSpec | UnversionedSpec;

interface Command {
    /**
     * Collection of argument definitions.
     */
    args: Args;

    /**
     * Map of sub-commands where key is a string representing the command
     * argument and the value implements `Command`.
     */
    commands?: {
        [key: string]: Command
    }
}

interface Args {
    /**
     * When value is `string`, implementation should treat as `Arg` with `name`
     * set to value and `type` set to 'option'`.
     */
    [index: number]: Arg | string;
}

type useValueTypes = 'string' | 'number' | 'boolean';

interface Arg {

    /**
     * Name of argument.
     */
    name: string;

    /**
     * String to print, if different from name.
     */
    key?: string;

    /**
     * Indicates argument(s) of other name(s) are synonymous.
     */
    aka?: string | string[];

    /**
     * When `type` is not provided, implementation is expected to default to
     * 'option'.
     * 
     *   - `option`: prepends `name` or `key` with "--" when emitting argv.
     *               i.e. `[ ..., "--foo" ]`
     *   - `flag`: prepends `name` or `key` with "-" when emitting argv.
     *             i.e. `[ ..., "-f" ]`
     *   - `value`: uses `name` or `key` as-is when emitting argv.
     *              i.e. `[ ..., "foo" ]`
     *   - `values`: same behavior as `value` (may change in future versions)
     *              i.e. `[ ..., "foo" ]`
     *   - `--`: spreads arg `value` (as declared or as resolved from config)
     *           after a "--" field when emitting argv.
     *           i.e. `[ ..., "--", "bar" ]`
     *   - `variable`: provides a mechanism for declaring, sourcing or
     *                 templating variable data. Is not emitted.
     *   - `collection`: provices a mechanism for populating argv from named
     *                   collections of arguments.
     */
    type?: 'option'
        | 'flag'
        | 'value'
        | 'values'
        | '--'
        | 'variable'
        | 'collection';

    /**
     * Optional hard-coded value for argument.
     */
    value?: any;

    /**
     * Optional default value for argument.
     */
    default?: any;

    /**
     * Value or array of valid values for given Arg.
     */
    choices?: string | number | boolean | string[];

    /**
     * `name`(s) of other argument(s) which must exist for this
     * argument to be valid. If any of the arguments defined
     * exist, then Arg will be considered valid.
     */
    with?: string[] | string;

    /**
     * `name`(s) of other argument(s) which must exist for this
     * argument to be valid. If any of the arguments defined
     * are missing, Arg will be considered invalid.
     */
    withAll?: string[] | string;

    /**
     * `name`(s) of other argument(s) which must not exist for this
     * argument to be valid.
     */
    without?: string[] | string;

    /**
     * `name`(s) of other argument(s) which must exist for this
     * argument to be emitted. If any of the other arguments
     * defined exist, Arg will be emitted.
     */
    when?: string[] | string;

    /**
     * `name`(s) of other argument(s) which must exist for this
     * argument to be emitted. If any of the other arguments
     * defined are missing, Arg will not be emmited.
     */
    whenAll?: string[] | string;

    /**
     * `name`(s) of other argument(s) which must not exist for this
     * argument to be emitted.
     */
    unless?: string[] | string;

    /**
     * Indicate when argument always required. Use `with` or `without` instead
     * if contextual conditions apply.
     */
    required?: boolean;

    /**
     * Defaults to `true` for Arg of `type` = "option" and to `false` for Arg of
     * `type` = "flag".
     * Alternatively, can be defined as one or more of the following strings:
     *   - "string"
     *   - "number"
     *   - "boolean"
     * If this form is used, then only values matching indicated type will be
     * emitted.
     */
    useValue?: boolean | useValueTypes | useValueTypes[];

    /**
     * Joins name and value with given string. When `true` name and value will
     * be joined with `=`.
     */
    join?: string | boolean;

    /**
     * Valid only for Args of type `flag`. Indicates whether the flag is able to
     * be concatonated with other flags.
     */
    concatable?: boolean;

    /**
     * Message text to display to user when prompting for Arg value.
     */
    message?: string;

    /**
     * Description to use for help text.
     */
    description?: string;
}
```

# Reference Implementation

In order to demostrate the viability and make ShellSpec useful, this repo contains a reference implementation.

## Install

```sh
npm i shellspec
```

## Usage

The ShellSpec module exports a factory function.

For example, here the spec for the `echo` shell command is declared and an `echo` instance is created.

```js
const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    version: '1.0.0',
    spec: {
        main: 'echo',
        args: [
            {
                name: 'args',
                type: 'values'
            }
        ]
    }
}

const echo = ShellSpec(spec);
```

When called with a spec definition, the ShellSpec factory returns an instance containing several methods for constructing or executing shell commands based on the given spec.

The primary methods exposed are as follows:

   *  `getArgv`
   *  `promptedArgv`
   *  `spawn`
   *  `promptedSpawn`

Let's take a look at the above methods, one at a time.

### `getArgv`

The `getArgv` method, when called with valid config, will use the values of the given config to return an argv array which can then be passed to a shell executor of your choosing.

```js
echo.getArgv({ args: [ 'hello', 'world' ] });

// => [ 'echo', 'hello', 'world' ]

echo.getArgv({ args: [ 'hi', 'mom' ] });

// => [ 'echo', 'hi', 'mom' ]
````

### `promptedArgv`

The `promptedArgv` method works the same as `getArgv` except that it returns a promise and will prompt the user for any required argument config which was not provided programmatically.

In order to demostrate this, we must make our script executable from the command-line and make a small edit to the `echo` spec we defined above, making the `args` argument required.

```js
#!/usr/bin/env node

const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    version: '1.0.0',
    spec: {
        main: 'echo',
        args: [
            {
                name: 'args',
                type: 'values',

                // here we add a `required` key to the spec which indicate the user should be prompted if this config value is missing
                required: true

            }
        ]
    }
};

const echo = ShellSpec(spec);

(async () => console.log(await echo.promptedArgv()))();
```

Save the above in a file named `myecho` and make it executable (`chmod +x myecho`), and and run it from your shell.

```sh
./myecho
? echo.args hello world
[ 'echo', 'hello', 'world' ]

# Note: When entering input for prompts, you can escape spaces with a backslash for single arguments which contain spaces.
./myecho
? echo.args hello\ world
[ 'echo', 'hello world' ]
```

### `spawn`

The `spawn` method works the same as `getArgv` except that it will execute the resolved command as a node child_process.

```js
#!/usr/bin/env node

const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    version: '1.0.0',
    spec: {
        main: 'echo',
        args: [
            {
                name: 'args',
                type: 'values'
            }
        ]
    }
};

const echo = ShellSpec(spec);

echo.spawn(); // returns <ChildProcess>
```

### `promptedSpawn`

The `promptedspawn` method works the same as `promptedArgv` except that it will execute the resolved command as a node child_process.

```js
#!/usr/bin/env node

const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    version: '1.0.0',
    spec: {
        main: 'echo',
        args: [
            {
                name: 'args',
                type: 'values',

                // here we add a `required` key to the spec which indicate the user should be prompted if this config value is missing
                required: true

            }
        ]
    }
};

const echo = ShellSpec(spec);

(async () => await echo.promptedSpawn())(); // resolves <ChildProcess>
```

# Using the Spec

For now, let's just learn by example. Take a look over some of the examples below to better understand how some of the available options on the spec affect the command output.

## `aws`

Here's a small piece of what could become a full AWS CLI spec. This demostrates how to define and work with subcommands.

```js

const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    version: '1.0.0',
    spec: {
        main: 'aws',
        args: [
            {
                name: 'debug',
                type: 'option'
            },
            {
                name: 'endpoint-url',
                type: 'option'
            }
        ],
        commands: {
            s3: {
                commands: {
                    cp: {
                        args: [
                            {
                                name: 'src',
                                type: 'option'
                            },
                            {
                                name: 'dest',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    }
};

const aws = ShellSpec(spec);

aws.getArgv({
    debug: true,
    s3: {
        cp: {
            src: './foo',
            dest: './bar'
        }
    }
}, 's3.cp');

// => [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo', '--dest', './bar' ];
```

## `docker`

This partial docker spec shows one way you can used named collections as well as variable arguments and EL-style templating.

```js

const ShellSpec = require('shellspec');

const spec = {
    kind: 'shell',
    version: '1.0.0',
    spec: {
        main: 'docker',
        collections: {
            tag: [
                {
                    name: 'registry',
                    type: 'variable'
                },
                {
                    name: 'name',
                    type: 'variable',
                    required: true
                },
                {
                    name: 'version',
                    type: 'variable',
                    default: 'latest'
                },
                {
                    name: 'tag',
                    type: 'variable',
                    value: '${registry ? `${registry}/` : ""}${name}:${version}'
                }
            ]
        },
        commands: {
            build: {
                args: [
                    {
                        name: 'tag',
                        type: 'collection'
                    },
                    {
                        name: 'tag',
                        type: 'option',
                        value: '${tag}'
                    },
                    {
                        name: 'context',
                        type: 'value',
                        default: '.'
                    }
                ]
            },
            run: {
                args: [
                    {
                        name: 'interactive',
                        type: 'option',
                        useValue: false
                    },
                    {
                        name: 'tty',
                        type: 'option',
                        useValue: false
                    },
                    {
                        name: 'tag',
                        type: 'collection'
                    },
                    {
                        name: 'tag',
                        type: 'value',
                        value: '${tag}'
                    },
                    {
                        "name": 'command',
                        "type": 'value'
                    }
                ]
            },
            push: {
                args: [
                    {
                        name: 'tag',
                        type: 'collection'
                    }
                ]
            }
        }
    }
};

const docker = ShellSpec(spec);

docker.getArgv({
    build: {
        name: 'foo',
        version: 'latest',
        context: '.'
    }
}, 'build');

// => [ 'docker', 'build', '--tag', 'foo:latest', '.' ];

docker.getArgv({
    run: {
        name: 'foo',
        version: 'latest',
        command: 'sh'
    }
}, 'run');

// => [ 'docker', 'run', 'foo:latest', 'sh' ];

```

# License

MIT
