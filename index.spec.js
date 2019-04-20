import test from 'ava';
import ShellLoader from '.';

test('basics shallow', t => {
    const spec = {
        main: {
            args: [
                'aws',
                {
                    name: 'debug',
                    type: 'option'
                },
                {
                    name: 'endpoint-url',
                    type: 'option'
                }
            ]
        },
        subs: [
            {
                main: {
                    args: [
                        's3'
                    ]
                },
                subs: [
                    {
                        main: {
                            args: [
                                {
                                    name: 'cp',
                                    type: 'option'
                                },
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
        ]
    };

    const loader = ShellLoader(spec);

    const input = {
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

    const output = [ 'aws', '--debug', 'true', 's3', 'cp', '--src', './foo', '--dest', './bar' ];

    const argv = loader(input);

    t.deepEqual(argv, output);
});
