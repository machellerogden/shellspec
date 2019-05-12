# ShellSpec

> Shell command specification and JavaScript reference implementation

# Descriptor Syntax

TypeScript is used below to describe the specification. TypeScript is prefered here over something like EBNF in hopes that it will be more approachable. Please note ShellSpec has nothing to do with TypeScript. Even the reference implementation (contained in this repo) does not use TypeScript. It is simply here to act as a descriptor syntax.

# Specification

The intention of ShellSpec is that any shell command can be specified by implementing the `Definition` interface (described in TypeScript) below.

```ts
interface Definition {
    kind: 'shell';
    spec: Command;
}

interface Command {
    command: string;
    collections?: {
        [key: string]: Args
    };
    concatFlags?: string[] | boolean;
    args: Args;
}

interface Args {
    // when value is `string`, implementation should treat as `Arg` with `name` set to value and `type` set to 'option'`
    [index: number]: Command | Arg | string;
}

interface Arg {
    name: string;
    // when `type` is not provided, implementation is expected to default to 'option'
    type?: 'option' | 'flag' | 'value' | 'values' | 'collection';
    required?: boolean;
    useValue?: boolean;
    useEquals?: boolean;
}
```

# Reference Implementation

In order to demostrate the viability and make ShellSpec useful, this repo contains a reference implementation. It's usage is best described through examples.

# Hello World

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

echo.getArgv({ args: [ 'hello', 'world' ] });

// => [ 'echo', 'hello', 'world' ]
````

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
                required: true
            }
        ]
    }
}

const echo = ShellSpec(spec);

echo.promptedSpawn();
```


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
