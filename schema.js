'use strict';

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

const [ major ] = require('./version').split('.');
const versionRegExp = new RegExp(`^${major}\\.?\\d+?.\\d+?`);

const conditionalsSchema = alternatives([
    string(),
    array().items(string())
]);

const useValueTypesSchema = string().valid(
    'string',
    'number',
    'boolean'
);

const argsSchema = array().items(
    string(), 
    object({
        name: string().required(),
        key: string(),
        aka: alternatives([
            string(),
            array().items(string())
        ]),
        type: string().valid(
            'option',
            'flag',
            'value',
            'values',
            '--',
            'variable',
            'collection'
        ),
        value: any(),
        default: any(),
        choices: array().items(boolean(), string()),
        with: conditionalsSchema,
        withAll: conditionalsSchema,
        without: conditionalsSchema,
        when: conditionalsSchema,
        whenAll: conditionalsSchema,
        unless: conditionalsSchema,
        required: boolean(),
        useValue: alternatives([
            array().items(useValueTypesSchema),
            useValueTypesSchema,
            boolean()
        ]),
        join: alternatives([
            boolean(),
            string().allow('')
        ]),
        concatable: boolean(),
        message: string(),
        description: string()
    })
);

const baseSpecSchema = object({
    main: string(),
    collections: object().pattern(
        string(),
        argsSchema
    )
});

const commandSchema = object({
    args: argsSchema,
    commands: object().pattern(string(), lazy(() => commandSchema))
});

const versionsSchema = object({
    versions: object().pattern(
        string(),
        alternatives([
            string(),
            commandSchema
        ])
    )
});

const versionedSpecSchema = baseSpecSchema.concat(versionsSchema);

const unversionedSpecSchema = baseSpecSchema.concat(commandSchema);

const definitionSchema = object({
    kind: string().valid('shell'),
    version: string().regex(versionRegExp).required(),
    spec: alternatives([
        versionedSpecSchema,
        unversionedSpecSchema
    ])
});

module.exports = definitionSchema;
