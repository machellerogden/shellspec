import test from 'ava';
import ShellLoader from '.';

test('basics shallow', t => {
    const spec = {
        main: {
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
                    main: {
                        command: 's3',
                        args: [
                            {
                                main: {
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
                            }
                        ]
                    }
                }
            ]
        }
    };

    const loader = ShellLoader({ spec });

    const input = {
        debug: true,
        s3: {
            cp: {
                src: './foo',
                dest: './bar'
            }
        }
    };

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo', '--dest', './bar' ];

    const argv = loader(input);
    console.log('argv', argv);

    t.deepEqual(argv, output);
});
