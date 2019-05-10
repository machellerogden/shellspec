# ShellSpec

> Shell command specification and JavaScript reference implementation

# Specification

Described in TypeScript for convenience, the ShellSpec specification is as follows.

```ts
interface Definition {
    kind: string;
    spec: Command;
}

interface Command {
    command: string;
    args: Args;
}

interface Args {
    // when value is `string`, implementation is expected to default to `Arg` with `type: 'option'`
    [index: number]: Command | Arg | string;
}

interface Arg {
    name: string;
    // when `type` is not provided, implementation is expected to default to 'option'
    type?: 'option' | 'flag' | 'value' | 'values' | string;
    required?: boolean;
    useValue?: boolean;
    useEquals?: boolean;
}
```

# Reference Implementation

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
