# ShellSpec

> Shell command specification and JavaScript reference implementation


# Specification

The intention of ShellSpec is that any shell command can be specified by implementing the `Definition` interface below.

> #### A Note on Descriptor Syntax
TypeScript is used below to describe the specification. TypeScript is prefered over something like EBNF in hopes that it will be more approachable. Please note ShellSpec has nothing to do with TypeScript. Even the reference implementation (contained in this repo) does not use TypeScript. It appears here simply to act as a descriptor syntax.

```ts

/**
 * Top-level of spec file must implement `Definition`
 */
interface Definition {
    kind: 'shell';
    spec: Command;
}

interface Command {

    /**
     * Name of command.
     */
    command: string;

    /**
     * Map of named collections which are reusable throughout args and
     * subcommands via Args of `type` = 'collection' where Arg `name` = {key of
     * `collections`}. All Args of `type` = 'collection' are populated at
     * compile time.
     */
    collections?: {
        [key: string]: Args
    };

    /**
     * Collection of argument definitions.
     */
    args: Args;
}

interface Args {
    /**
     * When value is `string`, implementation should treat as `Arg` with `name`
     * set to value and `type` set to 'option'`.
     */
    [index: number]: Command | Arg | string;
}

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
     * When `type` is not provided, implementation is expected to default to
     * 'option'.
     */
    type?: 'option' | 'flag' | 'value' | 'values' | 'variable' | 'collection';

    /**
     * Optional hard-coded value for argument.
     */
    value?: any;

    /**
     * Optional default value for argument.
     */
    default?: any;

    /**
     * Array of valid values for given Arg.
     */
    choices?: string[];

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
     */
    useValue?: boolean;

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
    spec: {
        command: 'echo',
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
    spec: {
        command: 'echo',
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
    spec: {
        command: 'echo',
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
    spec: {
        command: 'echo',
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
    spec: {
        command: 'aws',
        args: [
            {
                name: 'debug',
                type: 'option'
            },
            {
                name: 'endpoint-url',
                type: 'option'
            },
            {
                command: 's3',
                args: [
                    {
                        command: 'cp',
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
                ]
            }
        ]
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
    spec: {
        command: 'docker',
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
        args: [
            {
                command: 'build',
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
            {
                command: 'run',
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
            {
                command: 'push',
                args: [
                    {
                        name: 'tag',
                        type: 'collection'
                    }
                ]
            }
        ]
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

## TODO

   *  Spec version support.
   *  Command version support.

# A Note on Implementation Challenges

The main challenge with specing commands in a single data structure is that spec
files can quickly grow to be thousands of lines of data. Consider what the spec
file for the AWS CLI might look like—I haven't attempted it but I imagine it
would surpass 100k lines of formatted JSON data. Currently there are a couple
different approaches I've considered which might help address this issue.

Splitting the spec into multiple files is the obvious solution in terms of
maintainability but this would requires the author to add a compile stage in
order to build the data back into a single spec for parsing or it would require
some sort of expression language (EL) which could be evaluated at runtime which
would allow partials to be loaded only as needed. Both of these approaches would
be implementation concerns—the spec definition itself remains valid.

To expand a bit on the above...

If an entire spec is loaded at compile time, consider the space and time
complexity of loading and parsing what might be a 100k line spec file just to
run a single sub-command. The performance implications are not ideal.

The right EL, if applied dynamically at runtime, could side-step the concerns
around space complexity, but in all the ELs I'm currently aware of, expressions
are evaluated at compile-time. Regardless, theoretically, this could be solved
outside of the spec definition by a sufficiently rigorous implementation.

You'll note that the spec definition does not yet address command versioning.
Supporting multiple versions in a single spec further compounds the above
issue. For now, you can simply draft multiple specifications and compile from a
common base specification if it makes sense to do so. But there could be a good
argument out there for baking versioning into the spec itself. Regardless,
sharing and re-using data between versions becomes critical to any practical
implementation of versioning.

The exact definition for versioning of commands is still being considered,
but below is one possible proposal being considered.

The Definition node would accept a `Versions` node as an alternative to the
current definition which only accepts a `Command` node.

```ts
interface Definition {
    kind: 'shell';
    spec: Versions | Command;
}
```

A `Versions` node would defined as a map with a required `default` key, the
value of which would be a version string which acts as a key with which to
resolve the default `Command` node. Remaining properties on the `Versions` node
would be version strings. The value of a any given key could be either
a `Command` node, or a string referencing another key on the `Versions`
node. Supporting version strings that reference other version string would be
necessary in order to support tag-like versions such as "latest" or "stable".

```ts
interface Versions {
    default: string
    [key: string]?: Command | string
}
```

Additionally, the `Command` node would be updated to include an optional
`extends` key the value of which would be a version string. When defined,
the implementation would be expected to deep merge the `Command` node with
the version of the `Command` node as resolved by it's `extends` key.

```ts
interface Command {
    extends?: string
    // ...
}
```

The challenge here would be in the implementation of the merge strategy,
specifically regarding how to handle the ordering of positional arguments.
There's no good solution for this that I'm able to conjure up at this time.
Even my [sugarmerge](https://www.npmjs.com/package/sugarmerge) package seems
insufficient to the cause in this case. Honestly, sugarmerge could do it but
any such implementation would be brittle and difficult to maintain as it
would require specific and hard-coded splicing directives.

So, for now, versioning remains purely an implementation concern. If anyone
is able to propose a reasonable solution, or if something else comes to me
I'd love to find a way to roll it in.

# License

MIT
