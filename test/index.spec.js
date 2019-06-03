import test from 'ava';
import ShellSpec from '..';

import aws from './mocks/aws';
import docker from './mocks/docker';
import git from './mocks/git';

test('aws 1', t => {

    const { getArgv } = ShellSpec(aws);

    const config = {
        aws: {
            debug: true,
            s3: {
                cp: {
                    src: './foo',
                    dest: './bar'
                }
            }
        }
    };

    const argv = getArgv(config, 'aws.s3.cp');

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo', '--dest', './bar' ];

    t.deepEqual(argv, output);
});

test('aws 2', t => {

    const { getArgv } = ShellSpec(aws);

    const config = {
        aws: {
            debug: true,
            s3: {
                cp: {
                    src: './foo'
                }
            }
        }
    };

    const argv = getArgv(config, 'aws.s3.cp');

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo' ];

    t.deepEqual(argv, output);
});

test('docker build', t => {

    const { getArgv } = ShellSpec(docker);

    const config = {
        docker: {
            build: {
                name: 'foo',
                version: 'latest',
                context: '.'
            }
        }
    };

    const argv = getArgv(config, 'docker.build');

    const output = [ 'docker', 'build', '--tag', 'foo:latest', '.' ];

    t.deepEqual(argv, output);
});

test('docker run', t => {

    const { getArgv } = ShellSpec(docker);

    const config = {
        docker: {
            run: {
                name: 'foo',
                version: 'latest',
                command: 'sh'
            }
        }
    };

    const argv = getArgv(config, 'docker.run');

    const output = [ 'docker', 'run', 'foo:latest', 'sh' ];

    t.deepEqual(argv, output);
});

test('git rev-parse defaults', t => {

    const { getArgv } = ShellSpec(git);

    const config = {};

    const argv = getArgv(config, 'git.rev-parse');

    const output = [ 'git', 'rev-parse', '--short=12', 'HEAD' ];

    t.deepEqual(argv, output);
});

test('git rev-parse w options', t => {

    const { getArgv } = ShellSpec(git);

    const config = {
        git: {
            "rev-parse": {
                short: 8,
                refspec: "origin/master"
            }
        }
    };

    const argv = getArgv(config, 'git.rev-parse');

    const output = [ 'git', 'rev-parse', '--short=8', 'origin/master' ];

    t.deepEqual(argv, output);
});

test('simple echo', t => {

    const spec = {
        kind: 'shell',
        commands: {
            echo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'args',
                                type: 'values'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        echo: {
            args: [ 'foo', 'bar', 123, true, false ]
        }
    };

    const argv = getArgv(config, 'echo');

    const output = [ 'echo', 'foo', 'bar', '123', 'true', 'false' ];

    t.deepEqual(argv, output);
});

test('with 1', t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'formal',
                                type: 'option',
                                useValue: false,
                                with: [ 'last-name' ]
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            'last-name': 'Heller-Ogden',
            formal: true
        }
    };

    const argv = getArgv(config, 'greet');

    const output = [ 'greet', '--formal', '--first-name', 'Jane', '--last-name', 'Heller-Ogden' ];

    t.deepEqual(argv, output);
});

test('with 2', t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'formal',
                                type: 'option',
                                useValue: false,
                                with: [ 'last-name' ]
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            formal: true
        }
    };

    t.throws(() => getArgv(config, 'greet'), 'the option `formal` must be accompanied by `last-name`');
});

test('with 3', t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'formal',
                                type: 'option',
                                useValue: false,
                                with: 'last-name'
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            formal: true
        }
    };

    t.throws(() => getArgv(config, 'greet'), 'the option `formal` must be accompanied by `last-name`');
});

test('with all', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                withAll: [ 'b', 'c', 'd' ]
                            },
                            {
                                name: 'b',
                                type: 'flag'
                            },
                            {
                                name: 'c',
                                type: 'flag'
                            },
                            {
                                name: 'd',
                                type: 'flag'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    t.deepEqual(getArgv({
        foo: {
            a: true,
            b: true,
            c: true,
            d: true
        }
    }, 'foo'), [ 'foo', '-a', '-b', '-c', '-d' ]);

    t.throws(() => getArgv({
        foo: {
            a: true,
            b: true,
            d: true
        }
    }, 'foo'), 'the flag `a` must be accompanied by all of the following: `b`, `c`, `d`');
});

test('with all 2', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true,
                                withAll: [ 'b', 'c', 'd' ]
                            },
                            {
                                name: 'b',
                                concatable: true,
                                type: 'flag'
                            },
                            {
                                name: 'c',
                                concatable: true,
                                type: 'flag'
                            },
                            {
                                name: 'd',
                                concatable: true,
                                type: 'flag'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    t.deepEqual(getArgv({
        foo: {
            a: true,
            b: true,
            c: true,
            d: true
        }
    }, 'foo'), [ 'foo', '-abcd' ]);

    t.throws(() => getArgv({
        foo: {
            a: true,
            b: true,
            d: true
        }
    }, 'foo'), 'the flag `a` must be accompanied by all of the following: `b`, `c`, `d`');
});

test('without 1', t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'casual',
                                type: 'option',
                                useValue: false,
                                without: [ 'last-name' ]
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            casual: true
        }
    };

    const argv = getArgv(config, 'greet');

    const output = [ 'greet', '--casual', '--first-name', 'Jane' ];

    t.deepEqual(argv, output);
});

test('without 2', t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'casual',
                                type: 'option',
                                useValue: false,
                                without: [ 'last-name' ]
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            'last-name': 'Heller-Ogden',
            casual: true
        }
    };

    t.throws(() => getArgv(config, 'greet'), 'the option `casual` and the option `last-name` cannot be used together');
});

test('without 3', t => {

    const spec = {
        kind: 'shell',
        commands: {
            greet: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'casual',
                                type: 'option',
                                useValue: false,
                                without: 'last-name'
                            },
                            {
                                name: 'first-name',
                                type: 'option'
                            },
                            {
                                name: 'last-name',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        greet: {
            'first-name': 'Jane',
            'last-name': 'Heller-Ogden',
            casual: true
        }
    };

    t.throws(() => getArgv(config, 'greet'), 'the option `casual` and the option `last-name` cannot be used together');
});

test('concat flags', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'b',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'c',
                                type: 'flag',
                                concatable: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        foo: {
            a: true,
            b: true,
            c: true
        }
    };

    const argv = getArgv(config, 'foo');

    const output = [ 'foo', '-abc' ];

    t.deepEqual(argv, output);
});

test('concat flags should only concat adjacent flags so as not to mess with arg order', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'b',
                                type: 'value'
                            },
                            {
                                name: 'c',
                                type: 'flag',
                                concatable: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        foo: {
            a: true,
            b: 'bar',
            c: true
        }
    };

    const argv = getArgv(config, 'foo');

    const output = [ 'foo', '-a', 'bar', '-c' ];

    t.deepEqual(argv, output);
});

test('concat flags more tests', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'b',
                                type: 'flag'
                            },
                            {
                                name: 'c',
                                type: 'flag',
                                concatable: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        foo: {
            a: true,
            b: true,
            c: true
        }
    };

    const argv = getArgv(config, 'foo');

    const output = [ 'foo', '-a', '-b', '-c' ];

    t.deepEqual(argv, output);
});

test('concat flags does the right thing when useValue === true', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'a',
                                type: 'flag',
                                concatable: true
                            },
                            {
                                name: 'b',
                                type: 'flag',
                                useValue: true,
                                concatable: true
                            },
                            {
                                name: 'c',
                                type: 'flag',
                                concatable: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        foo: {
            a: true,
            b: true,
            c: true
        }
    };

    const argv = getArgv(config, 'foo');

    const output = [ 'foo', '-ab', 'true', '-c' ];

    t.deepEqual(argv, output);
});

test('multiple same option', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                type: 'option'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        foo: {
            bar: [ 'a', 'b', 'c' ]
        }
    };

    const argv = getArgv(config, 'foo');

    const output = [ 'foo', '--bar', 'a', '--bar', 'b', '--bar', 'c' ];

    t.deepEqual(argv, output);
});

test('multiple same flag', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'b',
                                type: 'flag'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        foo: {
            b: [ 'a', 'b', 'c' ]
        }
    };

    const argv = getArgv(config, 'foo');

    const output = [ 'foo', '-b', '-b', '-b' ];

    t.deepEqual(argv, output);
});

test('multiple same flag with value', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'b',
                                type: 'flag',
                                useValue: true
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    const config = {
        foo: {
            b: [ 'a', 'b', 'c' ]
        }
    };

    const argv = getArgv(config, 'foo');

    const output = [ 'foo', '-b', 'a', '-b', 'b', '-b', 'c' ];

    t.deepEqual(argv, output);
});

test('arg can specify valid values as "choices"', t => {

    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                type: 'option',
                                choices: [
                                    'a',
                                    'b',
                                    'c'
                                ]
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    t.deepEqual(getArgv({ foo: { bar: 'a' } }, 'foo'), [ 'foo', '--bar', 'a' ]);
    t.throws(() => getArgv({ foo: { bar: 'd' } }, 'foo'), 'the option `bar` has invalid value of "d". Valid values are: "a", "b", "c"');
});

test('double dash args', t => {

    const { getArgv } = ShellSpec(git);

    const config = {
        git: {
            add: {
                pathspec: [ './src', './dist' ]
            }
        }
    };

    const argv = getArgv(config, 'git.add');

    const output = [ 'git', 'add', '--', './src', './dist' ];

    t.deepEqual(argv, output);
});

test('useValue only for given type', t => {
    const spec = {
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                type: 'option',
                                useValue: 'string'
                            }
                        ]
                    }
                }
            }
        }
    };

    const { getArgv } = ShellSpec(spec);

    t.deepEqual(getArgv({ foo: { bar: true } }, 'foo'), [ 'foo', '--bar' ]);
    t.deepEqual(getArgv({ foo: { bar: 'baz' } }, 'foo'), [ 'foo', '--bar', 'baz' ]);
});

test('conditional printing', t => {

    const { getArgv } = ShellSpec(git);

    t.deepEqual(getArgv({
        git: {
            branch: {
                D: true,
                r: true,
                branchname: 'foo'
            }
        }
    }, 'git.branch'), [ 'git', 'branch', '-D', '-r', 'foo' ]);

    t.deepEqual(getArgv({
        git: {
            branch: {
                list: true,
                r: true,
                branchname: 'foo'
            }
        }
    }, 'git.branch'), [ 'git', 'branch', '-r', '--list', 'foo' ]);
});

test('key can be different from name', t => {

    const { getArgv } = ShellSpec({
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                key: 'baz'
                            }
                        ]
                    }
                }
            }
        }
    });

    t.deepEqual(getArgv({ foo: { bar: true } }, 'foo'), [ 'foo', '--baz', 'true' ]);
});

test('dynamic useValue does the right thing when join is specified', t => {

    const { getArgv } = ShellSpec({
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                useValue: 'string',
                                join: '='
                            }
                        ]
                    }
                }
            }
        }
    });

    t.deepEqual(getArgv({ foo: { bar: true } }, 'foo'), [ 'foo', '--bar' ]);
    t.deepEqual(getArgv({ foo: { bar: 'baz' } }, 'foo'), [ 'foo', '--bar=baz' ]);
    t.deepEqual(getArgv({ foo: { bar: false } }, 'foo'), [ 'foo', '--bar' ]);
});

test('git double dash on clone', t => {

    const { getArgv } = ShellSpec(git);

    t.deepEqual(getArgv({
        git: {
            clone: {
                '--': true,
                repository: 'foo'
            }
        }
    }, 'git.clone'), [ 'git', 'clone', '--', 'foo' ]);
});

test('command not found - main cmd', t => {
    const { getArgv } = ShellSpec(git);

    t.throws(() => getArgv({}, 'foo'), 'Command `foo` not found.');
});

test('command not found - sub cmd', t => {
    const { getArgv } = ShellSpec(git);

    t.throws(() => getArgv({}, 'git.foo'), 'Command `foo` not found.');
});

test('aka', t => {

    const { getArgv } = ShellSpec({
        kind: 'shell',
        commands: {
            foo: {
                versions: {
                    default: {
                        args: [
                            {
                                name: 'bar',
                                useValue: 'number',
                                join: '=',
                                required: true,
                                aka: [ 'b' ]
                            },
                            {
                                name: 'b',
                                type: 'flag',
                                useValue: 'number',
                                required: true,
                                join: '',
                                aka: 'bar'
                            }
                        ]
                    }
                }
            }
        }
    });

    t.throws(() => getArgv({}, 'foo'), 'missing required config for `bar`');
    t.deepEqual(getArgv({ foo: { bar: 123 } }, 'foo'), [ 'foo', '--bar=123' ]);
    t.deepEqual(getArgv({ foo: { b: 123 } }, 'foo'), [ 'foo', '-b123' ]);
    t.throws(() => getArgv({ foo: { b: true, bar: true } }, 'foo'), 'the option `bar` and the flag `b` cannot be used together');
});
